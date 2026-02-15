import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { stripe } from "@/lib/stripe";
import { TRPCError } from "@trpc/server";
import { getPlanFromSubscription } from "../../services/billing/subscription";

type BillingInterval = "monthly" | "annual";
type PlanType = "pro" | "team" | "lifetime";

function getPriceId(plan: PlanType, interval?: BillingInterval): string {
  if (plan === "lifetime") {
    const id = process.env.STRIPE_LIFETIME_PRICE_ID;
    if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Lifetime price not configured" });
    return id;
  }

  const priceMap: Record<string, string | undefined> = {
    "pro-monthly": process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    "pro-annual": process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    "team-monthly": process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
    "team-annual": process.env.STRIPE_TEAM_ANNUAL_PRICE_ID,
  };

  const key = `${plan}-${interval || "monthly"}`;
  const id = priceMap[key];

  if (!id) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Price not configured: ${key}` });
  }

  return id;
}

export const billingRouter = router({
  // Shows subscription status of the portfolio being viewed
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const sub = await ctx.uow.user.findSubscriptionFull(ctx.portfolio.ownerId);

    if (!sub) {
      return {
        plan: "free" as const,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    const plan = getPlanFromSubscription({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    });

    return {
      plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }),

  // Creates checkout session for the CURRENT USER (not portfolio owner)
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["pro", "team", "lifetime"]),
        interval: z.enum(["monthly", "annual"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const priceId = getPriceId(input.plan, input.interval);
      const isLifetime = input.plan === "lifetime";

      // Check for existing customer
      const existing = await ctx.uow.user.findSubscriptionFull(ctx.user.id);

      const session = await stripe.checkout.sessions.create({
        mode: isLifetime ? "payment" : "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
        metadata: {
          userId: ctx.user.id,
          plan: input.plan,
        },
        ...(existing?.stripeCustomerId
          ? { customer: existing.stripeCustomerId }
          : { customer_email: ctx.user.email }),
      });

      return { url: session.url };
    }),

  // Creates portal session for the CURRENT USER (not portfolio owner)
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await ctx.uow.user.findSubscriptionFull(ctx.user.id);

    if (!sub?.stripeCustomerId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No billing account found",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return { url: session.url };
  }),

  // Get trial status and property count for the current portfolio owner
  getTrialStatus: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;

    const [user, sub, propertyCount] = await Promise.all([
      ctx.uow.user.findById(ownerId),
      ctx.uow.user.findSubscriptionFull(ownerId),
      ctx.uow.property.countByOwner(ownerId),
    ]);

    if (!user || !user.trialEndsAt) {
      return { isOnTrial: false, trialEndsAt: null, propertyCount: 0 };
    }

    if (sub && sub.status === "active") {
      return { isOnTrial: false, trialEndsAt: null, propertyCount: 0 };
    }

    return {
      isOnTrial: user.trialEndsAt > new Date(),
      trialEndsAt: user.trialEndsAt,
      propertyCount,
    };
  }),
});
