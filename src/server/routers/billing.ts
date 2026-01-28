import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { subscriptions } from "../db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { TRPCError } from "@trpc/server";
import { getPlanFromSubscription } from "../services/subscription";

export const billingRouter = router({
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

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["pro", "team"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const priceId =
        input.plan === "pro"
          ? process.env.STRIPE_PRO_PRICE_ID
          : process.env.STRIPE_TEAM_PRICE_ID;

      if (!priceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe price not configured",
        });
      }

      // Check for existing customer
      const existing = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, ctx.user.id),
      });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
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
