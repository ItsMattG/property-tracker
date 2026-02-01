# Stripe Free Trials & Billing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 14-day free Pro trial (no card required), monthly/annual billing options, and lifetime deal for first 100 users.

**Architecture:** Trial state stored on users table (not Stripe) until payment. Property locking enforced via `locked` column. Daily cron handles trial expiration and email reminders.

**Tech Stack:** Next.js, Drizzle ORM, Stripe, Resend (email), Vercel Cron

---

## Task 1: Database Migration - Trial Fields on Users

**Files:**
- Create: `drizzle/0024_user_trials.sql`
- Modify: `src/server/db/schema.ts:492-500`

**Step 1: Write the migration SQL**

Create `drizzle/0024_user_trials.sql`:

```sql
ALTER TABLE "users" ADD COLUMN "trial_started_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "trial_ends_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "trial_plan" VARCHAR(20) DEFAULT 'pro';
```

**Step 2: Update schema.ts users table**

In `src/server/db/schema.ts`, update the users table (around line 492):

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  mobilePasswordHash: text("mobile_password_hash"),
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialPlan: varchar("trial_plan", { length: 20 }).default("pro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 3: Run migration**

Run: `pnpm drizzle-kit push`
Expected: Migration applies successfully

**Step 4: Commit**

```bash
git add drizzle/0024_user_trials.sql src/server/db/schema.ts
git commit -m "feat(db): add trial fields to users table"
```

---

## Task 2: Database Migration - Locked Field on Properties

**Files:**
- Create: `drizzle/0025_property_locked.sql`
- Modify: `src/server/db/schema.ts:720-741`

**Step 1: Write the migration SQL**

Create `drizzle/0025_property_locked.sql`:

```sql
ALTER TABLE "properties" ADD COLUMN "locked" BOOLEAN DEFAULT false NOT NULL;
```

**Step 2: Update schema.ts properties table**

In `src/server/db/schema.ts`, add locked field to properties (around line 740, before createdAt):

```typescript
  locked: boolean("locked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
```

**Step 3: Run migration**

Run: `pnpm drizzle-kit push`
Expected: Migration applies successfully

**Step 4: Commit**

```bash
git add drizzle/0025_property_locked.sql src/server/db/schema.ts
git commit -m "feat(db): add locked field to properties table"
```

---

## Task 3: Database Migration - Lifetime Plan Enum

**Files:**
- Create: `drizzle/0026_lifetime_plan.sql`
- Modify: `src/server/db/schema.ts:3139-3143`

**Step 1: Write the migration SQL**

Create `drizzle/0026_lifetime_plan.sql`:

```sql
ALTER TYPE "subscription_plan" ADD VALUE IF NOT EXISTS 'lifetime';
```

**Step 2: Update schema.ts subscription plan enum**

In `src/server/db/schema.ts`, update subscriptionPlanEnum (around line 3139):

```typescript
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "pro",
  "team",
  "lifetime",
]);
```

**Step 3: Run migration**

Run: `pnpm drizzle-kit push`
Expected: Migration applies successfully

**Step 4: Commit**

```bash
git add drizzle/0026_lifetime_plan.sql src/server/db/schema.ts
git commit -m "feat(db): add lifetime to subscription plan enum"
```

---

## Task 4: Update Subscription Service - Plan Resolution with Trial

**Files:**
- Modify: `src/server/services/subscription.ts`

**Step 1: Update Plan type and PLAN_RANK**

```typescript
export type Plan = "free" | "pro" | "team" | "lifetime";

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  team: 2,
  lifetime: 2, // Same as team for feature access
};
```

**Step 2: Update PLAN_LIMITS to include lifetime**

Add after team limits:

```typescript
  lifetime: {
    maxProperties: Infinity,
    bankFeeds: true,
    export: true,
    emailForwarding: true,
    aiChat: true,
    teamMembers: false,
    advisorAccess: false,
    auditLog: false,
  },
```

**Step 3: Add getUserPlan function**

Add new function:

```typescript
interface UserTrialInfo {
  trialEndsAt: Date | null;
  trialPlan: string | null;
}

export function getUserPlan(
  user: UserTrialInfo,
  subscription: SubscriptionInfo | null
): Plan {
  // Active subscription takes priority
  const subPlan = getPlanFromSubscription(subscription);
  if (subPlan !== "free") {
    return subPlan;
  }

  // Check if in trial period
  if (user.trialEndsAt && new Date() < user.trialEndsAt) {
    return (user.trialPlan as Plan) || "pro";
  }

  return "free";
}
```

**Step 4: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/server/services/subscription.ts
git commit -m "feat(subscription): add trial and lifetime plan support"
```

---

## Task 5: Set Trial on User Creation

**Files:**
- Modify: `src/app/api/webhooks/clerk/route.ts`

**Step 1: Import addDays from date-fns**

Add at top:

```typescript
import { addDays } from "date-fns";
```

**Step 2: Update user.created handler**

Replace the db.insert call (around line 62-66):

```typescript
    try {
      const now = new Date();
      await db.insert(users).values({
        clerkId: id,
        email: primaryEmail.email_address,
        name,
        trialStartedAt: now,
        trialEndsAt: addDays(now, 14),
        trialPlan: "pro",
      });

      console.log("User created with 14-day Pro trial:", id);
    } catch (error) {
```

**Step 3: Verify build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/webhooks/clerk/route.ts
git commit -m "feat(auth): auto-start 14-day Pro trial on signup"
```

---

## Task 6: Update Billing Router - Multiple Price IDs

**Files:**
- Modify: `src/server/routers/billing.ts`

**Step 1: Add price ID helper**

Add after imports:

```typescript
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
```

**Step 2: Update createCheckoutSession input and logic**

Replace the createCheckoutSession mutation:

```typescript
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
```

**Step 3: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/billing.ts
git commit -m "feat(billing): support monthly, annual, and lifetime pricing"
```

---

## Task 7: Update Stripe Webhook - Lifetime Payments

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Update checkout.session.completed handler**

Replace the switch case for checkout.session.completed:

```typescript
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          await handleLifetimeCheckout(session);
        } else {
          await handleCheckoutComplete(session);
        }
        break;
      }
```

**Step 2: Add handleLifetimeCheckout function**

Add after handleCheckoutComplete:

```typescript
async function handleLifetimeCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId || !session.customer) return;

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: null, // No subscription for one-time
      plan: "lifetime",
      status: "active",
      currentPeriodEnd: null, // Never expires
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeCustomerId: session.customer as string,
        plan: "lifetime",
        status: "active",
        currentPeriodEnd: null,
        updatedAt: new Date(),
      },
    });

  logger.info("Lifetime checkout complete", { userId });
}
```

**Step 3: Update getPlanFromPriceId to handle lifetime**

Update the function:

```typescript
function getPlanFromPriceId(
  priceId: string | undefined
): "free" | "pro" | "team" | "lifetime" {
  if (priceId === process.env.STRIPE_LIFETIME_PRICE_ID) return "lifetime";
  if (
    priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID
  )
    return "pro";
  if (
    priceId === process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_TEAM_ANNUAL_PRICE_ID
  )
    return "team";
  return "free";
}
```

**Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhook): handle lifetime one-time payments"
```

---

## Task 8: Trial Reminder Cron Job

**Files:**
- Create: `src/app/api/cron/trial-reminders/route.ts`
- Create: `src/lib/email/templates/trial-reminder.ts`

**Step 1: Create email template**

Create `src/lib/email/templates/trial-reminder.ts`:

```typescript
export function trialReminderSubject(daysLeft: number): string {
  if (daysLeft === 0) return "Your PropertyTracker Pro trial has ended";
  if (daysLeft === 1) return "Last day of your PropertyTracker Pro trial";
  return `Your PropertyTracker Pro trial ends in ${daysLeft} days`;
}

export function trialReminderTemplate({
  name,
  daysLeft,
  upgradeUrl,
}: {
  name: string | null;
  daysLeft: number;
  upgradeUrl: string;
}): string {
  const greeting = name ? `Hi ${name},` : "Hi,";

  if (daysLeft === 0) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Pro Trial Has Ended</h2>
        <p>${greeting}</p>
        <p>Your 14-day PropertyTracker Pro trial has ended. Your account has been moved to the Free plan.</p>
        <p>On the Free plan, you can access 1 property. Any additional properties have been locked but your data is safe.</p>
        <p>Ready to unlock everything?</p>
        <a href="${upgradeUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Upgrade to Pro
        </a>
        <p>Thanks for trying PropertyTracker!</p>
      </div>
    `;
  }

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Pro Trial ${daysLeft === 1 ? "Ends Tomorrow" : `Ends in ${daysLeft} Days`}</h2>
      <p>${greeting}</p>
      <p>Your PropertyTracker Pro trial ${daysLeft === 1 ? "ends tomorrow" : `ends in ${daysLeft} days`}.</p>
      <p>To keep access to unlimited properties, bank feeds, tax reports, and more, upgrade now:</p>
      <a href="${upgradeUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Upgrade to Pro - $14/month
      </a>
      <p>Thanks for using PropertyTracker!</p>
    </div>
  `;
}
```

**Step 2: Create cron route**

Create `src/app/api/cron/trial-reminders/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, properties, subscriptions } from "@/server/db/schema";
import { eq, and, lt, gte, isNull, asc, inArray } from "drizzle-orm";
import { addDays, startOfDay, endOfDay } from "date-fns";
import { sendEmailNotification } from "@/server/services/notification";
import { trialReminderSubject, trialReminderTemplate } from "@/lib/email/templates/trial-reminder";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const now = new Date();
  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`;

  try {
    // Find users with trials ending in 3 days
    const threeDaysFromNow = addDays(now, 3);
    const threeDayUsers = await db.query.users.findMany({
      where: and(
        gte(users.trialEndsAt, startOfDay(threeDaysFromNow)),
        lt(users.trialEndsAt, endOfDay(threeDaysFromNow))
      ),
    });

    // Find users with trials ending in 1 day
    const oneDayFromNow = addDays(now, 1);
    const oneDayUsers = await db.query.users.findMany({
      where: and(
        gte(users.trialEndsAt, startOfDay(oneDayFromNow)),
        lt(users.trialEndsAt, endOfDay(oneDayFromNow))
      ),
    });

    // Find users with trials that just expired (no subscription)
    const expiredUsers = await db.query.users.findMany({
      where: and(
        lt(users.trialEndsAt, now),
        gte(users.trialEndsAt, addDays(now, -1)) // Only process recent expirations
      ),
    });

    let emailsSent = 0;
    let propertiesLocked = 0;

    // Send 3-day reminder
    for (const user of threeDayUsers) {
      // Skip if user already has subscription
      const sub = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, user.id), eq(subscriptions.status, "active")),
      });
      if (sub) continue;

      await sendEmailNotification(
        user.email,
        trialReminderSubject(3),
        trialReminderTemplate({ name: user.name, daysLeft: 3, upgradeUrl })
      );
      emailsSent++;
    }

    // Send 1-day reminder
    for (const user of oneDayUsers) {
      const sub = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, user.id), eq(subscriptions.status, "active")),
      });
      if (sub) continue;

      await sendEmailNotification(
        user.email,
        trialReminderSubject(1),
        trialReminderTemplate({ name: user.name, daysLeft: 1, upgradeUrl })
      );
      emailsSent++;
    }

    // Process expired trials
    for (const user of expiredUsers) {
      const sub = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, user.id), eq(subscriptions.status, "active")),
      });
      if (sub) continue; // User subscribed, skip

      // Lock properties beyond the first
      const userProperties = await db.query.properties.findMany({
        where: eq(properties.userId, user.id),
        orderBy: [asc(properties.createdAt)],
      });

      const propertiesToLock = userProperties.slice(1);
      if (propertiesToLock.length > 0) {
        await db
          .update(properties)
          .set({ locked: true })
          .where(inArray(properties.id, propertiesToLock.map((p) => p.id)));
        propertiesLocked += propertiesToLock.length;
      }

      // Send trial ended email
      await sendEmailNotification(
        user.email,
        trialReminderSubject(0),
        trialReminderTemplate({ name: user.name, daysLeft: 0, upgradeUrl })
      );
      emailsSent++;
    }

    logger.info("Trial reminders processed", { emailsSent, propertiesLocked });

    return NextResponse.json({
      success: true,
      emailsSent,
      propertiesLocked,
    });
  } catch (error) {
    logger.error("Trial reminder cron error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Add to vercel.json cron config**

Check if vercel.json exists and add cron, or note for manual addition.

**Step 4: Commit**

```bash
git add src/app/api/cron/trial-reminders/route.ts src/lib/email/templates/trial-reminder.ts
git commit -m "feat(cron): add trial reminder emails and property locking"
```

---

## Task 9: Unlock Properties on Subscription

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Add unlockUserProperties function**

Add after handleLifetimeCheckout:

```typescript
async function unlockUserProperties(userId: string) {
  await db
    .update(properties)
    .set({ locked: false })
    .where(eq(properties.userId, userId));

  logger.info("Unlocked properties for user", { userId });
}
```

**Step 2: Import properties**

Add to imports:

```typescript
import { subscriptions, referralCredits, properties } from "@/server/db/schema";
```

**Step 3: Call unlock in handleCheckoutComplete**

Add after the db.insert/upsert in handleCheckoutComplete:

```typescript
  // Unlock any locked properties
  await unlockUserProperties(userId);
```

**Step 4: Call unlock in handleLifetimeCheckout**

Add at end of handleLifetimeCheckout:

```typescript
  // Unlock any locked properties
  await unlockUserProperties(userId);
```

**Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhook): unlock properties when user subscribes"
```

---

## Task 10: Trial Banner Component

**Files:**
- Create: `src/components/billing/TrialBanner.tsx`

**Step 1: Create component**

```typescript
"use client";

import { differenceInDays } from "date-fns";
import { AlertTriangle, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

interface TrialBannerProps {
  trialEndsAt: Date;
}

export function TrialBanner({ trialEndsAt }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const daysLeft = differenceInDays(trialEndsAt, new Date());

  // Don't show if more than 7 days left or dismissed
  if (daysLeft > 7 || dismissed) return null;

  const isUrgent = daysLeft <= 1;

  return (
    <div
      className={`relative px-4 py-3 flex items-center justify-between gap-4 ${
        isUrgent
          ? "bg-red-50 border-b border-red-200 text-red-800"
          : "bg-yellow-50 border-b border-yellow-200 text-yellow-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-sm">
          {daysLeft === 0
            ? "Your Pro trial ends today!"
            : daysLeft === 1
              ? "Your Pro trial ends tomorrow"
              : `Your Pro trial ends in ${daysLeft} days`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" asChild>
          <Link href="/settings/billing">
            <Zap className="w-3 h-3 mr-1" />
            Upgrade Now
          </Link>
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-black/5 rounded"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/billing/TrialBanner.tsx
git commit -m "feat(ui): add trial expiry banner component"
```

---

## Task 11: Add Trial Banner to Dashboard Layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Find dashboard layout and add TrialBanner**

Import and add TrialBanner conditionally based on user trial status. The exact implementation depends on how the layout fetches user data. Typically:

```typescript
import { TrialBanner } from "@/components/billing/TrialBanner";

// In the layout component, after getting user data:
{user.trialEndsAt && !subscription && (
  <TrialBanner trialEndsAt={new Date(user.trialEndsAt)} />
)}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat(ui): show trial banner in dashboard"
```

---

## Task 12: Update Billing Page - Interval Toggle

**Files:**
- Modify: `src/app/(dashboard)/settings/billing/page.tsx`

**Step 1: Add billing interval state**

Add after PLANS constant:

```typescript
type BillingInterval = "monthly" | "annual";

const PRICES = {
  pro: { monthly: 19, annual: 168 },
  team: { monthly: 39, annual: 348 },
  lifetime: 249,
} as const;
```

**Step 2: Add state for interval in component**

```typescript
const [interval, setInterval] = useState<BillingInterval>("annual");
```

**Step 3: Add interval toggle UI**

Add after the page description:

```typescript
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-4 p-1 bg-muted rounded-lg w-fit mx-auto">
        <button
          onClick={() => setInterval("monthly")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            interval === "monthly"
              ? "bg-background shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("annual")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            interval === "annual"
              ? "bg-background shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Annual <span className="text-green-600 ml-1">Save 26%</span>
        </button>
      </div>
```

**Step 4: Update plan prices display**

Update price display to use interval:

```typescript
<p className="text-2xl font-bold">
  {plan.id === "free"
    ? "$0"
    : `$${interval === "monthly" ? PRICES[plan.id as keyof typeof PRICES].monthly : Math.round(PRICES[plan.id as keyof typeof PRICES].annual / 12)}`}
  <span className="text-sm font-normal text-muted-foreground">/month</span>
</p>
{plan.id !== "free" && interval === "annual" && (
  <p className="text-xs text-muted-foreground">
    Billed annually (${PRICES[plan.id as keyof typeof PRICES].annual}/year)
  </p>
)}
```

**Step 5: Update checkout mutation call**

```typescript
checkout.mutate({
  plan: plan.id as "pro" | "team",
  interval,
})
```

**Step 6: Commit**

```bash
git add src/app/(dashboard)/settings/billing/page.tsx
git commit -m "feat(billing): add monthly/annual toggle"
```

---

## Task 13: Update LifetimeBanner - Show Remaining Seats

**Files:**
- Modify: `src/components/landing/LifetimeBanner.tsx`

**Step 1: Make component async and fetch count**

Update to be a server component that fetches lifetime count:

```typescript
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

const LIFETIME_LIMIT = 100;

async function getLifetimeCount(): Promise<number> {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.plan, "lifetime"));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function LifetimeBanner() {
  const count = await getLifetimeCount();
  const remaining = LIFETIME_LIMIT - count;

  // Hide if sold out
  if (remaining <= 0) return null;

  return (
    <div className="relative mb-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold">Founding Member Deal</span>
        </div>
        <p className="text-sm text-muted-foreground text-center sm:text-left flex-1">
          Get lifetime Pro access for a one-time payment of $249.
          No subscription ever. <strong>{remaining} of {LIFETIME_LIMIT} spots remaining.</strong>
        </p>
        <Button size="sm" asChild>
          <Link href="/sign-up?plan=lifetime">Claim Lifetime Deal</Link>
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Remove client-side dismiss logic**

The dismiss functionality needs to be handled differently for server components, or moved to a client wrapper. For simplicity, remove the dismiss button initially.

**Step 3: Commit**

```bash
git add src/components/landing/LifetimeBanner.tsx
git commit -m "feat(landing): show remaining lifetime deal seats"
```

---

## Task 14: Property Access Control

**Files:**
- Modify: `src/server/routers/property.ts` (or equivalent property queries)

**Step 1: Find property list query**

Locate where properties are fetched for the user.

**Step 2: Add locked filter for free users**

When fetching properties, filter out locked ones for free users:

```typescript
// After determining user plan
if (plan === "free") {
  // Only return unlocked properties
  return ctx.db.query.properties.findMany({
    where: and(
      eq(properties.userId, ctx.user.id),
      eq(properties.locked, false)
    ),
  });
}
```

**Step 3: Commit**

```bash
git add src/server/routers/property.ts
git commit -m "feat(property): filter locked properties for free users"
```

---

## Task 15: Add Env Var Documentation

**Files:**
- Modify: `.env.example`

**Step 1: Add new Stripe price IDs**

```
# Stripe Billing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_TEAM_MONTHLY_PRICE_ID=price_...
STRIPE_TEAM_ANNUAL_PRICE_ID=price_...
STRIPE_LIFETIME_PRICE_ID=price_...
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add new Stripe price env vars to example"
```

---

## Task 16: Final Verification

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Create final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address verification issues"
```
