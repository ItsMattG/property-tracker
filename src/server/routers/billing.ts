import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { subscriptions } from "../db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { TRPCError } from "@trpc/server";
import { getPlanFromSubscription } from "../services/subscription";

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
  // (could be user's own or a portfolio they have access to)
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const sub = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.portfolio.ownerId),
    });

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
  // Users can only create/upgrade their own subscriptions
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
      const existing = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, ctx.user.id),
      });

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
  // Users can only manage their own billing
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.user.id),
    });

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
});
