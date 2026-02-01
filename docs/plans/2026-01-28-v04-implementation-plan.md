# V0.4 Implementation Plan — Revenue, Growth, Depth & Infrastructure

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Stripe billing, rental yield calculator, blog content, analytics, rate limiting, and conversion prompts to PropertyTracker.

**Architecture:** Stripe Checkout + Customer Portal for subscription management, with a `planGatedProcedure` tRPC middleware that checks subscription tier before allowing Pro/Team features. Rental yield calculated from existing transaction data. PostHog for product analytics. tRPC rate limiting middleware for API protection.

**Tech Stack:** Stripe (checkout, webhooks, customer portal), PostHog, Next.js API routes, tRPC middleware, Drizzle ORM, Vercel cron

---

## Pre-existing (skip these)

- **Sitemap:** `src/app/sitemap.ts` — already dynamic with blog posts
- **Robots.txt:** `src/app/robots.ts` — already configured
- **Blog infrastructure:** `src/app/blog/`, `content/blog/` — 4 posts exist
- **CI/CD:** `.github/workflows/ci.yml` — full 8-job pipeline
- **Depreciation schema:** `src/server/db/schema.ts:2222-2264` — tables exist

---

## Task 1: Stripe Package & Environment Setup

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`
- Create: `src/lib/stripe.ts`

**Step 1: Install Stripe SDK**

Run: `npm install stripe`

**Step 2: Add env vars to `.env.local.example`**

Add after line 39:
```
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...
```

**Step 3: Create Stripe client singleton**

Create `src/lib/stripe.ts`:
```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30.basil",
  typescript: true,
});
```

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example src/lib/stripe.ts
git commit -m "feat(stripe): add Stripe SDK and environment configuration"
```

---

## Task 2: Subscriptions Database Schema

**Files:**
- Modify: `src/server/db/schema.ts` (after line 3135)
- Create: `drizzle/0022_stripe_subscriptions.sql`

**Step 1: Add schema to `src/server/db/schema.ts`**

Add after the `referralCredits` table (line 3135):

```typescript
// Stripe subscriptions
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "pro",
  "team",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "incomplete",
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  plan: subscriptionPlanEnum("plan").default("free").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 2: Write migration SQL**

Create `drizzle/0022_stripe_subscriptions.sql`:
```sql
DO $$ BEGIN
  CREATE TYPE "subscription_plan" AS ENUM ('free', 'pro', 'team');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "subscription_status" AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_customer_id" text NOT NULL,
  "stripe_subscription_id" text,
  "plan" "subscription_plan" DEFAULT 'free' NOT NULL,
  "status" "subscription_status" DEFAULT 'active' NOT NULL,
  "current_period_end" timestamp,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
  CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
  CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/0022_stripe_subscriptions.sql
git commit -m "feat(stripe): add subscriptions table schema and migration"
```

---

## Task 3: Subscription Service & Plan-Gated Middleware

**Files:**
- Create: `src/server/services/subscription.ts`
- Create: `src/server/services/__tests__/subscription.test.ts`
- Modify: `src/server/trpc.ts` (add `proProcedure` and `teamProcedure`)

**Step 1: Write the failing test**

Create `src/server/services/__tests__/subscription.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  getPlanFromSubscription,
  isPlanSufficient,
  PLAN_LIMITS,
} from "../subscription";

describe("subscription service", () => {
  describe("getPlanFromSubscription", () => {
    it("returns free when no subscription", () => {
      expect(getPlanFromSubscription(null)).toBe("free");
    });

    it("returns plan from active subscription", () => {
      expect(
        getPlanFromSubscription({
          plan: "pro",
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        })
      ).toBe("pro");
    });

    it("returns free when subscription is canceled and expired", () => {
      expect(
        getPlanFromSubscription({
          plan: "pro",
          status: "canceled",
          currentPeriodEnd: new Date(Date.now() - 86400000),
        })
      ).toBe("free");
    });

    it("returns plan when canceled but not yet expired", () => {
      expect(
        getPlanFromSubscription({
          plan: "pro",
          status: "canceled",
          currentPeriodEnd: new Date(Date.now() + 86400000),
        })
      ).toBe("pro");
    });
  });

  describe("isPlanSufficient", () => {
    it("free is sufficient for free features", () => {
      expect(isPlanSufficient("free", "free")).toBe(true);
    });

    it("free is not sufficient for pro features", () => {
      expect(isPlanSufficient("free", "pro")).toBe(false);
    });

    it("pro is sufficient for pro features", () => {
      expect(isPlanSufficient("pro", "pro")).toBe(true);
    });

    it("team is sufficient for pro features", () => {
      expect(isPlanSufficient("team", "pro")).toBe(true);
    });

    it("pro is not sufficient for team features", () => {
      expect(isPlanSufficient("pro", "team")).toBe(false);
    });
  });

  describe("PLAN_LIMITS", () => {
    it("free allows 1 property", () => {
      expect(PLAN_LIMITS.free.maxProperties).toBe(1);
    });

    it("pro allows unlimited properties", () => {
      expect(PLAN_LIMITS.pro.maxProperties).toBe(Infinity);
    });

    it("team allows unlimited properties", () => {
      expect(PLAN_LIMITS.team.maxProperties).toBe(Infinity);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/subscription.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/server/services/subscription.ts`:
```typescript
export type Plan = "free" | "pro" | "team";

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  team: 2,
};

export const PLAN_LIMITS = {
  free: {
    maxProperties: 1,
    bankFeeds: false,
    export: false,
    emailForwarding: false,
    aiChat: false,
    teamMembers: false,
    advisorAccess: false,
    auditLog: false,
  },
  pro: {
    maxProperties: Infinity,
    bankFeeds: true,
    export: true,
    emailForwarding: true,
    aiChat: true,
    teamMembers: false,
    advisorAccess: false,
    auditLog: false,
  },
  team: {
    maxProperties: Infinity,
    bankFeeds: true,
    export: true,
    emailForwarding: true,
    aiChat: true,
    teamMembers: true,
    advisorAccess: true,
    auditLog: true,
  },
} as const;

interface SubscriptionInfo {
  plan: Plan;
  status: string;
  currentPeriodEnd: Date | null;
}

export function getPlanFromSubscription(sub: SubscriptionInfo | null): Plan {
  if (!sub) return "free";

  // Canceled but still within paid period
  if (sub.status === "canceled") {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
      return sub.plan;
    }
    return "free";
  }

  if (sub.status === "active" || sub.status === "trialing") {
    return sub.plan;
  }

  return "free";
}

export function isPlanSufficient(
  currentPlan: Plan,
  requiredPlan: Plan
): boolean {
  return PLAN_RANK[currentPlan] >= PLAN_RANK[requiredPlan];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/subscription.test.ts`
Expected: PASS

**Step 5: Add plan-gated procedures to `src/server/trpc.ts`**

Add after `bankProcedure` (after line 271):

```typescript
import { subscriptions } from "./db/schema";
import { getPlanFromSubscription, isPlanSufficient, type Plan } from "./services/subscription";

// Procedure that requires a specific plan
function createPlanGatedProcedure(requiredPlan: Plan) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const sub = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.portfolio.ownerId),
    });

    const currentPlan = getPlanFromSubscription(
      sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
    );

    if (!isPlanSufficient(currentPlan, requiredPlan)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This feature requires the ${requiredPlan} plan. Please upgrade at /settings/billing.`,
      });
    }

    return next({
      ctx: { ...ctx, plan: currentPlan },
    });
  });
}

export const proProcedure = createPlanGatedProcedure("pro");
export const teamProcedure = createPlanGatedProcedure("team");
```

Also add `subscriptions` to the import from `./db/schema` at line 5.

**Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add src/server/services/subscription.ts src/server/services/__tests__/subscription.test.ts src/server/trpc.ts
git commit -m "feat(stripe): subscription service with plan-gated tRPC middleware"
```

---

## Task 4: Stripe Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Create webhook handler**

Create `src/app/api/webhooks/stripe/route.ts`:
```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import { subscriptions, users, referralCredits } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }
      default:
        logger.debug("Unhandled Stripe event", { type: event.type });
    }
  } catch (err) {
    logger.error("Stripe webhook handler error", { type: event.type, err });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId || !session.subscription || !session.customer) return;

  const plan = session.metadata?.plan as "pro" | "team" | undefined;
  if (!plan) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      plan,
      status: "active",
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        plan,
        status: "active",
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        updatedAt: new Date(),
      },
    });

  logger.info("Checkout complete", { userId, plan });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  await db
    .update(subscriptions)
    .set({
      plan,
      status: mapStripeStatus(subscription.status),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  logger.info("Subscription updated", { subscriptionId: subscription.id, plan, status: subscription.status });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  logger.info("Subscription deleted", { subscriptionId: subscription.id });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  // Apply referral credits
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, invoice.subscription as string),
  });

  if (!sub) return;

  // Check for unused referral credits
  const [credit] = await db
    .select()
    .from(referralCredits)
    .where(
      and(
        eq(referralCredits.userId, sub.userId),
        isNull(referralCredits.appliedAt)
      )
    )
    .limit(1);

  if (credit) {
    await db
      .update(referralCredits)
      .set({ appliedAt: new Date() })
      .where(eq(referralCredits.id, credit.id));

    logger.info("Applied referral credit", { userId: sub.userId, creditId: credit.id });
  }
}

function getPlanFromPriceId(priceId: string | undefined): "free" | "pro" | "team" {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_TEAM_PRICE_ID) return "team";
  return "free";
}

function mapStripeStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "trialing" | "incomplete" {
  switch (status) {
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled": return "canceled";
    case "trialing": return "trialing";
    default: return "incomplete";
  }
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(stripe): webhook handler for subscription lifecycle events"
```

---

## Task 5: Stripe Billing Router (Checkout + Portal)

**Files:**
- Create: `src/server/routers/billing.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create billing router**

Create `src/server/routers/billing.ts`:
```typescript
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
      return { plan: "free" as const, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
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
    .input(z.object({
      plan: z.enum(["pro", "team"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const priceId = input.plan === "pro"
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

      const sessionParams: Record<string, unknown> = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
        metadata: {
          userId: ctx.user.id,
          plan: input.plan,
        },
      };

      if (existing?.stripeCustomerId) {
        sessionParams.customer = existing.stripeCustomerId;
      } else {
        sessionParams.customer_email = ctx.user.email;
      }

      const session = await stripe.checkout.sessions.create(
        sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
      );

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
```

**Step 2: Register in `_app.ts`**

Add import: `import { billingRouter } from "./billing";`
Add to router: `billing: billingRouter,`

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/routers/billing.ts src/server/routers/_app.ts
git commit -m "feat(stripe): billing router with checkout and portal sessions"
```

---

## Task 6: Billing Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/billing/page.tsx`

**Step 1: Create billing page**

Create `src/app/(dashboard)/settings/billing/page.tsx`:
```tsx
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Zap, Users, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    features: [
      "1 investment property",
      "Basic tracking",
      "Climate risk data",
      "Property valuations",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$19/mo",
    features: [
      "Unlimited properties",
      "Bank feeds & auto-categorization",
      "Tax reports & MyTax export",
      "Email forwarding",
      "AI chat assistant",
      "Document extraction",
    ],
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$39/mo",
    features: [
      "Everything in Pro",
      "Team members & advisors",
      "Audit log",
      "Priority support",
      "Broker portal access",
    ],
  },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const { data: subscription, isLoading } = trpc.billing.getSubscription.useQuery();
  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });
  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated! Welcome to Pro.");
      utils.billing.getSubscription.invalidate();
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout canceled.");
    }
  }, [searchParams, utils]);

  const currentPlan = subscription?.plan ?? "free";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current plan status */}
      {subscription?.status && subscription.status !== "active" && (
        <Card className="border-yellow-500">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-600">
              Your subscription status is <strong>{subscription.status}</strong>.
              {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                <> Access continues until {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}.</>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade = plan.id !== "free" && !isCurrent && currentPlan === "free";
          const isDowngrade = plan.id === "free" && currentPlan !== "free";

          return (
            <Card
              key={plan.id}
              className={isCurrent ? "border-primary" : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <p className="text-2xl font-bold">{plan.price}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isUpgrade && (
                  <Button
                    className="w-full"
                    onClick={() => checkout.mutate({ plan: plan.id as "pro" | "team" })}
                    disabled={checkout.isPending}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Upgrade to {plan.name}
                  </Button>
                )}

                {isCurrent && currentPlan !== "free" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => portal.mutate()}
                    disabled={portal.isPending}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Subscription
                  </Button>
                )}

                {isDowngrade && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => portal.mutate()}
                    disabled={portal.isPending}
                  >
                    Manage Subscription
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manage billing */}
      {currentPlan !== "free" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Billing Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Update payment method, view invoices, or cancel your subscription.
            </p>
            <Button
              variant="outline"
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
            >
              Open Customer Portal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/billing/page.tsx
git commit -m "feat(stripe): billing settings page with plan cards and checkout"
```

---

## Task 7: Property Limit Enforcement

**Files:**
- Modify: `src/server/routers/property.ts`

**Step 1: Add property count check to create mutation**

In `src/server/routers/property.ts`, add a property limit check at the start of the `create` mutation (before the `ctx.db.insert(properties)` call, around line 46):

```typescript
// Check property limit for current plan
const sub = await ctx.db.query.subscriptions.findFirst({
  where: eq(subscriptions.userId, ctx.portfolio.ownerId),
});
const currentPlan = getPlanFromSubscription(
  sub ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null
);
const limit = PLAN_LIMITS[currentPlan].maxProperties;

if (limit !== Infinity) {
  const [propertyCount] = await ctx.db
    .select({ count: sql<number>`count(*)::int` })
    .from(properties)
    .where(eq(properties.userId, ctx.portfolio.ownerId));

  if ((propertyCount?.count ?? 0) >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Your ${currentPlan} plan allows up to ${limit} property. Upgrade to Pro for unlimited properties.`,
    });
  }
}
```

Add imports at top:
```typescript
import { subscriptions } from "../db/schema";
import { getPlanFromSubscription, PLAN_LIMITS } from "../services/subscription";
import { TRPCError } from "@trpc/server";
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/routers/property.ts
git commit -m "feat(stripe): enforce property limit based on subscription plan"
```

---

## Task 8: Rental Yield Calculator — Backend

**Files:**
- Create: `src/server/services/rental-yield.ts`
- Create: `src/server/services/__tests__/rental-yield.test.ts`

**Step 1: Write the failing test**

Create `src/server/services/__tests__/rental-yield.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { calculateGrossYield, calculateNetYield } from "../rental-yield";

describe("rental yield", () => {
  describe("calculateGrossYield", () => {
    it("calculates gross yield correctly", () => {
      // $500/week rent = $26,000/year, property value $500,000
      expect(calculateGrossYield(26000, 500000)).toBeCloseTo(5.2, 1);
    });

    it("returns 0 when no rent", () => {
      expect(calculateGrossYield(0, 500000)).toBe(0);
    });

    it("returns 0 when no value", () => {
      expect(calculateGrossYield(26000, 0)).toBe(0);
    });
  });

  describe("calculateNetYield", () => {
    it("calculates net yield correctly", () => {
      // $26,000 rent - $8,000 expenses = $18,000 net, value $500,000
      expect(calculateNetYield(26000, 8000, 500000)).toBeCloseTo(3.6, 1);
    });

    it("returns negative yield when expenses exceed rent", () => {
      expect(calculateNetYield(26000, 30000, 500000)).toBeCloseTo(-0.8, 1);
    });

    it("returns 0 when no value", () => {
      expect(calculateNetYield(26000, 8000, 0)).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/rental-yield.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create `src/server/services/rental-yield.ts`:
```typescript
/**
 * Calculate gross rental yield percentage.
 * Gross Yield = (Annual Rent / Property Value) * 100
 */
export function calculateGrossYield(
  annualRent: number,
  propertyValue: number
): number {
  if (propertyValue <= 0 || annualRent <= 0) return 0;
  return (annualRent / propertyValue) * 100;
}

/**
 * Calculate net rental yield percentage.
 * Net Yield = ((Annual Rent - Annual Expenses) / Property Value) * 100
 */
export function calculateNetYield(
  annualRent: number,
  annualExpenses: number,
  propertyValue: number
): number {
  if (propertyValue <= 0) return 0;
  return ((annualRent - annualExpenses) / propertyValue) * 100;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/rental-yield.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/rental-yield.ts src/server/services/__tests__/rental-yield.test.ts
git commit -m "feat(yield): rental yield calculation service with tests"
```

---

## Task 9: Rental Yield Router & API

**Files:**
- Create: `src/server/routers/rentalYield.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create rental yield router**

Create `src/server/routers/rentalYield.ts`:
```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { properties, transactions, propertyValues } from "../db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { calculateGrossYield, calculateNetYield } from "../services/rental-yield";

export const rentalYieldRouter = router({
  getForProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get property with current value
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      // Get latest valuation or fall back to purchase price
      const [latestValue] = await ctx.db
        .select()
        .from(propertyValues)
        .where(eq(propertyValues.propertyId, input.propertyId))
        .orderBy(desc(propertyValues.valuationDate))
        .limit(1);

      const currentValue = latestValue
        ? parseFloat(latestValue.estimatedValue)
        : parseFloat(property.purchasePrice);

      // Calculate annual rent (income transactions in last 12 months)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const [rentResult] = await ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(ABS(amount::numeric)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.propertyId, input.propertyId),
            eq(transactions.category, "rental_income"),
            gte(transactions.date, oneYearAgo.toISOString().split("T")[0])
          )
        );

      const annualRent = parseFloat(rentResult?.total ?? "0");

      // Calculate annual expenses (all expense categories in last 12 months)
      const [expenseResult] = await ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(ABS(amount::numeric)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.propertyId, input.propertyId),
            sql`${transactions.category} != 'rental_income'`,
            sql`${transactions.category} != 'uncategorized'`,
            sql`${transactions.category} IS NOT NULL`,
            gte(transactions.date, oneYearAgo.toISOString().split("T")[0])
          )
        );

      const annualExpenses = parseFloat(expenseResult?.total ?? "0");

      const grossYield = calculateGrossYield(annualRent, currentValue);
      const netYield = calculateNetYield(annualRent, annualExpenses, currentValue);

      return {
        propertyId: input.propertyId,
        currentValue,
        annualRent,
        annualExpenses,
        grossYield: Math.round(grossYield * 100) / 100,
        netYield: Math.round(netYield * 100) / 100,
      };
    }),

  getPortfolioSummary: protectedProcedure.query(async ({ ctx }) => {
    const userProperties = await ctx.db.query.properties.findMany({
      where: eq(properties.userId, ctx.portfolio.ownerId),
    });

    if (userProperties.length === 0) {
      return { properties: [], averageGrossYield: 0, averageNetYield: 0 };
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const results = await Promise.all(
      userProperties.map(async (property) => {
        const [latestValue] = await ctx.db
          .select()
          .from(propertyValues)
          .where(eq(propertyValues.propertyId, property.id))
          .orderBy(desc(propertyValues.valuationDate))
          .limit(1);

        const currentValue = latestValue
          ? parseFloat(latestValue.estimatedValue)
          : parseFloat(property.purchasePrice);

        const [rentResult] = await ctx.db
          .select({
            total: sql<string>`COALESCE(SUM(ABS(amount::numeric)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.propertyId, property.id),
              eq(transactions.category, "rental_income"),
              gte(transactions.date, oneYearAgo.toISOString().split("T")[0])
            )
          );

        const [expenseResult] = await ctx.db
          .select({
            total: sql<string>`COALESCE(SUM(ABS(amount::numeric)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.propertyId, property.id),
              sql`${transactions.category} != 'rental_income'`,
              sql`${transactions.category} != 'uncategorized'`,
              sql`${transactions.category} IS NOT NULL`,
              gte(transactions.date, oneYearAgo.toISOString().split("T")[0])
            )
          );

        const annualRent = parseFloat(rentResult?.total ?? "0");
        const annualExpenses = parseFloat(expenseResult?.total ?? "0");

        return {
          propertyId: property.id,
          address: property.address,
          suburb: property.suburb,
          currentValue,
          annualRent,
          annualExpenses,
          grossYield: Math.round(calculateGrossYield(annualRent, currentValue) * 100) / 100,
          netYield: Math.round(calculateNetYield(annualRent, annualExpenses, currentValue) * 100) / 100,
        };
      })
    );

    const withRent = results.filter((r) => r.annualRent > 0);
    const avgGross = withRent.length > 0
      ? withRent.reduce((sum, r) => sum + r.grossYield, 0) / withRent.length
      : 0;
    const avgNet = withRent.length > 0
      ? withRent.reduce((sum, r) => sum + r.netYield, 0) / withRent.length
      : 0;

    return {
      properties: results,
      averageGrossYield: Math.round(avgGross * 100) / 100,
      averageNetYield: Math.round(avgNet * 100) / 100,
    };
  }),
});
```

**Step 2: Register in `_app.ts`**

Add import: `import { rentalYieldRouter } from "./rentalYield";`
Add to router: `rentalYield: rentalYieldRouter,`

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/routers/rentalYield.ts src/server/routers/_app.ts
git commit -m "feat(yield): rental yield router with per-property and portfolio summary"
```

---

## Task 10: Rental Yield Dashboard Widget

**Files:**
- Create: `src/components/rental-yield/RentalYieldCard.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Create the widget component**

Create `src/components/rental-yield/RentalYieldCard.tsx`:
```tsx
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export function RentalYieldCard() {
  const { data, isLoading } = trpc.rentalYield.getPortfolioSummary.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rental Yield</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.properties.length === 0) {
    return null;
  }

  const hasRentData = data.properties.some((p) => p.annualRent > 0);
  if (!hasRentData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Rental Yield</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Avg Gross Yield</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              {data.averageGrossYield.toFixed(1)}%
              <TrendingUp className="w-4 h-4 text-green-500" />
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Net Yield</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              {data.averageNetYield.toFixed(1)}%
              {data.averageNetYield >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </p>
          </div>
        </div>

        {data.properties.length > 1 && (
          <div className="space-y-2">
            {data.properties
              .filter((p) => p.annualRent > 0)
              .map((p) => (
                <div
                  key={p.propertyId}
                  className="flex items-center justify-between text-sm border-t pt-2"
                >
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {p.address}, {p.suburb}
                  </span>
                  <span className="font-medium">
                    {p.grossYield.toFixed(1)}% / {p.netYield.toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to dashboard**

In `src/components/dashboard/DashboardClient.tsx`, add import:
```typescript
import { RentalYieldCard } from "@/components/rental-yield/RentalYieldCard";
```

Add the component after `<SavingsWidget />` (around line 201):
```tsx
<RentalYieldCard />
```

**Step 3: Create barrel export**

Create `src/components/rental-yield/index.ts`:
```typescript
export { RentalYieldCard } from "./RentalYieldCard";
```

**Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/rental-yield/ src/components/dashboard/DashboardClient.tsx
git commit -m "feat(yield): rental yield dashboard widget with portfolio summary"
```

---

## Task 11: Blog Content — 5th SEO Article

**Files:**
- Create: `content/blog/2026-03-03-negative-gearing-guide.md`

The v0.4 design calls for 5 SEO-targeted articles. 4 already exist. Add the 5th (negative gearing guide):

**Step 1: Create the blog post**

Create `content/blog/2026-03-03-negative-gearing-guide.md`:
```markdown
---
title: "Negative Gearing Explained: How It Works for Australian Property Investors"
slug: negative-gearing-guide
summary: "Understand how negative gearing works, when it makes sense, and how to track it with PropertyTracker."
category: tax
tags: ["negative gearing", "tax deductions", "investment property", "tax strategy"]
author: PropertyTracker Team
publishedAt: "2026-03-03"
---

## What Is Negative Gearing?

Negative gearing occurs when the costs of owning an investment property exceed the income it generates. The "loss" can be offset against your other income (like your salary), reducing your overall tax bill.

For example, if your rental property earns $25,000 per year in rent but costs $32,000 in mortgage interest, management fees, repairs, and depreciation, you have a $7,000 loss. This $7,000 reduces your taxable income.

## How Negative Gearing Reduces Your Tax

At a marginal tax rate of 37%, a $7,000 negative gearing loss saves you $2,590 in tax. The actual out-of-pocket cost of holding the property is the total loss minus the tax benefit.

| Item | Amount |
|------|--------|
| Rental income | $25,000 |
| Total expenses | $32,000 |
| Net loss | -$7,000 |
| Tax benefit (at 37%) | $2,590 |
| True cost of holding | $4,410 |

## Common Deductible Expenses

The ATO allows deductions for expenses directly related to earning rental income:

- **Mortgage interest** — the largest deduction for most investors
- **Property management fees** — typically 5-8% of rent
- **Council rates and water** — ongoing holding costs
- **Insurance** — landlord and building insurance
- **Repairs and maintenance** — fixing existing items (not improvements)
- **Depreciation** — Division 40 (plant & equipment) and Division 43 (building)
- **Travel to property** — limited since 2017 changes
- **Strata/body corporate fees** — for apartments and townhouses

## When Does Negative Gearing Make Sense?

Negative gearing is not a strategy on its own — it's a side effect of holding a property that costs more than it earns. It makes sense when:

1. **Capital growth potential** justifies the holding cost
2. **Your marginal tax rate** is high enough that the tax benefit is meaningful
3. **The property will eventually become positively geared** as rents increase

It does not make sense to deliberately lose money just for a tax deduction. The tax benefit only offsets part of the loss.

## Tracking Negative Gearing with PropertyTracker

PropertyTracker automatically calculates your net rental position:

1. **Import transactions** via bank feeds to capture all income and expenses
2. **Categorize expenses** using AI-powered auto-categorization
3. **View tax position** on the dashboard — see your net rental income or loss per property
4. **Export to MyTax** — Item 21 (Net rent) is pre-filled with your figures

The Tax Position card on your dashboard shows whether each property is positively or negatively geared in real time, so there are no surprises at tax time.

## The Bottom Line

Negative gearing is a tool, not a goal. Focus on acquiring properties with strong fundamentals (location, demand, growth potential) and use PropertyTracker to keep your expenses organized and your tax position clear.
```

**Step 2: Commit**

```bash
git add content/blog/2026-03-03-negative-gearing-guide.md
git commit -m "content(blog): add negative gearing guide for SEO"
```

---

## Task 12: Upgrade Prompts at Feature Gates

**Files:**
- Create: `src/components/billing/UpgradePrompt.tsx`

**Step 1: Create upgrade prompt component**

Create `src/components/billing/UpgradePrompt.tsx`:
```tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import Link from "next/link";

interface UpgradePromptProps {
  feature: string;
  description: string;
  plan?: "pro" | "team";
}

export function UpgradePrompt({
  feature,
  description,
  plan = "pro",
}: UpgradePromptProps) {
  const planName = plan === "team" ? "Team" : "Pro";
  const price = plan === "team" ? "$39/mo" : "$19/mo";

  return (
    <Card className="border-dashed">
      <CardContent className="pt-6 text-center">
        <Zap className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-semibold mb-1">{feature}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Link href="/settings/billing">
          <Button size="sm">
            Upgrade to {planName} — {price}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/billing/UpgradePrompt.tsx
git commit -m "feat(billing): reusable upgrade prompt component for feature gates"
```

---

## Task 13: PostHog Analytics Integration

**Files:**
- Create: `src/lib/posthog.ts`
- Create: `src/components/analytics/PostHogProvider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Install PostHog**

Run: `npm install posthog-js`

**Step 2: Create PostHog client**

Create `src/lib/posthog.ts`:
```typescript
import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // We handle this manually for SPA routing
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") {
        posthog.debug();
      }
    },
  });
}

export { posthog };
```

**Step 3: Create PostHog provider**

Create `src/components/analytics/PostHogProvider.tsx`:
```tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, posthog } from "@/lib/posthog";
import { useUser } from "@clerk/nextjs";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();

  useEffect(() => {
    initPostHog();
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!pathname) return;
    posthog.capture("$pageview", {
      $current_url: window.location.href,
    });
  }, [pathname, searchParams]);

  // Identify user
  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    }
  }, [user]);

  return <>{children}</>;
}
```

**Step 4: Add provider to layout**

In `src/app/layout.tsx`, add import:
```typescript
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
```

Wrap the children with `<PostHogProvider>` inside the existing provider tree (inside the body, wrapping the main content).

**Step 5: Add env var to `.env.local.example`**

Add:
```
# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add src/lib/posthog.ts src/components/analytics/ src/app/layout.tsx .env.local.example package.json package-lock.json
git commit -m "feat(analytics): PostHog integration with page tracking and user identification"
```

---

## Task 14: API Rate Limiting Middleware

**Files:**
- Create: `src/server/middleware/rate-limit.ts`
- Create: `src/server/middleware/__tests__/rate-limit.test.ts`
- Modify: `src/server/trpc.ts`

**Step 1: Write the failing test**

Create `src/server/middleware/__tests__/rate-limit.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "../rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60000, maxRequests: 3 });
  });

  it("allows requests within limit", () => {
    expect(limiter.check("user1")).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check("user1")).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check("user1")).toEqual({ allowed: true, remaining: 0 });
  });

  it("blocks requests over limit", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1")).toEqual({ allowed: false, remaining: 0 });
  });

  it("tracks users independently", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1").allowed).toBe(false);
    expect(limiter.check("user2").allowed).toBe(true);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1").allowed).toBe(false);

    vi.advanceTimersByTime(61000);
    expect(limiter.check("user1").allowed).toBe(true);
    vi.useRealTimers();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/middleware/__tests__/rate-limit.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create `src/server/middleware/rate-limit.ts`:
```typescript
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Clean up expired entry
    if (entry && now >= entry.resetAt) {
      this.store.delete(key);
    }

    const current = this.store.get(key);

    if (!current) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return { allowed: true, remaining: this.config.maxRequests - 1 };
    }

    if (current.count >= this.config.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    current.count++;
    return { allowed: true, remaining: this.config.maxRequests - current.count };
  }
}

// Pre-configured limiters
export const apiRateLimiter = new RateLimiter({
  windowMs: 60_000, // 1 minute
  maxRequests: 100,
});

export const authRateLimiter = new RateLimiter({
  windowMs: 60_000, // 1 minute
  maxRequests: 10,
});

export const webhookRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 200,
});
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/middleware/__tests__/rate-limit.test.ts`
Expected: PASS

**Step 5: Add rate limiting to tRPC**

In `src/server/trpc.ts`, add after the observabilityMiddleware definition (before `export const router`):

```typescript
import { apiRateLimiter } from "./middleware/rate-limit";

const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const userId = ctx.clerkId ?? ctx.headers?.get("x-forwarded-for") ?? "anonymous";
  const result = apiRateLimiter.check(userId);

  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again later.",
    });
  }

  return next({ ctx });
});
```

Update `protectedProcedure` to chain rate limiting:
```typescript
export const protectedProcedure = t.procedure.use(observabilityMiddleware).use(rateLimitMiddleware).use(async ({ ctx, next }) => {
```

**Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add src/server/middleware/ src/server/trpc.ts
git commit -m "feat(security): API rate limiting middleware with in-memory store"
```

---

## Task 15: CSP Headers

**Files:**
- Modify: `next.config.ts` or create `src/middleware.ts` security headers

**Step 1: Check if `next.config.ts` exists and read it**

Read the file to understand current config.

**Step 2: Add security headers**

Add to `next.config.ts` headers section:
```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ];
},
```

**Step 3: Run build check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add CSP and security response headers"
```

---

## Task 16: Monitoring — Sentry Error Boundaries

**Files:**
- Check existing Sentry setup and ensure error boundaries are in place

Sentry is already in `package.json` (`@sentry/nextjs`). This task verifies the integration is complete:

**Step 1: Verify Sentry config files exist**

Check for `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.

**Step 2: If missing, create minimal configs**

These should already exist from the `@sentry/nextjs` setup. If not, create them:

`sentry.client.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
```

**Step 3: Commit only if changes were needed**

```bash
git add sentry.*.config.ts
git commit -m "feat(monitoring): verify Sentry error tracking configuration"
```

---

## Summary & Feature Branches

**Recommended feature branches:**
1. `feature/stripe-billing` — Tasks 1-7 (Stripe integration)
2. `feature/rental-yield` — Tasks 8-10 (Rental yield calculator)
3. `feature/growth-seo` — Tasks 11-13 (Blog content, analytics, upgrade prompts)
4. `feature/security-hardening` — Tasks 14-16 (Rate limiting, CSP, monitoring)

**Implementation order:** Tasks 1-16 as listed (Stripe first since it's Critical priority, then high-priority features, then medium-priority infrastructure).
