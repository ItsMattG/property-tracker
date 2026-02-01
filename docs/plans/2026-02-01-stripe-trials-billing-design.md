# Stripe Free Trials & Billing Design

## Overview

Implement a complete billing system with:
- 14-day free Pro trial (no card required, auto-starts on signup)
- Monthly and annual billing options
- Lifetime deal for first 100 founding members

## Requirements Summary

| Feature | Details |
|---------|---------|
| Free trial | 14-day Pro, auto-start on signup, no card required |
| Trial expiry | Hard lock - only first property accessible, others locked |
| Trial reminders | In-app banner + emails at 3 days and 1 day before expiry |
| Monthly billing | Pro $19/mo, Team $39/mo |
| Annual billing | Pro $168/yr (~$14/mo), Team $348/yr (~$29/mo) |
| Lifetime deal | $249 one-time for permanent Pro, first 100 users only |

## Architecture

### Trial System (No Stripe Until Payment)

```
User signs up
    ↓
Create user record with:
  - trialStartedAt: now()
  - trialPlan: 'pro'
  - trialEndsAt: now() + 14 days
    ↓
User gets full Pro access
    ↓
Daily cron job checks trials:
  - 3 days left → send reminder email
  - 1 day left → send reminder email
  - 0 days left → lock excess properties
    ↓
User adds payment → create Stripe subscription
    ↓
Clear trial fields, set subscription active
```

### Access Control Logic

```typescript
function getUserPlan(user: User, subscription: Subscription | null): Plan {
  // Active subscription takes priority
  if (subscription?.status === 'active' || subscription?.status === 'trialing') {
    return subscription.plan; // 'pro' | 'team' | 'lifetime'
  }

  // Check if in trial period
  if (user.trialEndsAt && new Date() < user.trialEndsAt) {
    return user.trialPlan; // 'pro'
  }

  // Default to free
  return 'free';
}
```

## Database Changes

### Migration: Add trial fields to users

```sql
ALTER TABLE users ADD COLUMN trial_started_at TIMESTAMP;
ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN trial_plan VARCHAR(20) DEFAULT 'pro';
```

### Migration: Add locked field to properties

```sql
ALTER TABLE properties ADD COLUMN locked BOOLEAN DEFAULT false NOT NULL;
```

### Migration: Update subscription_plan enum

```sql
ALTER TYPE subscription_plan ADD VALUE 'lifetime';
```

## Stripe Configuration

### Products & Prices

| Product | Env Var | Amount | Mode |
|---------|---------|--------|------|
| Pro Monthly | `STRIPE_PRO_MONTHLY_PRICE_ID` | $19/mo | subscription |
| Pro Annual | `STRIPE_PRO_ANNUAL_PRICE_ID` | $168/yr | subscription |
| Team Monthly | `STRIPE_TEAM_MONTHLY_PRICE_ID` | $39/mo | subscription |
| Team Annual | `STRIPE_TEAM_ANNUAL_PRICE_ID` | $348/yr | subscription |
| Lifetime Pro | `STRIPE_LIFETIME_PRICE_ID` | $249 | payment (one-time) |

### Checkout Session Changes

```typescript
// For subscriptions (Pro/Team)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  // ... rest
});

// For lifetime deal
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: STRIPE_LIFETIME_PRICE_ID, quantity: 1 }],
  // ... rest
});
```

### Webhook Updates

Handle `checkout.session.completed` for both modes:

```typescript
case "checkout.session.completed": {
  const session = event.data.object;

  if (session.mode === 'payment') {
    // Lifetime deal - create subscription record without Stripe subscription ID
    await handleLifetimeCheckout(session);
  } else {
    // Regular subscription
    await handleCheckoutComplete(session);
  }
}
```

## Lifetime Deal Mechanics

### Tracking 100-seat Limit

```typescript
async function getLifetimeSeatsRemaining(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.plan, 'lifetime'));

  return Math.max(0, 100 - (result?.count ?? 0));
}
```

### LifetimeBanner Updates

```typescript
export async function LifetimeBanner() {
  const remaining = await getLifetimeSeatsRemaining();

  if (remaining <= 0) return null;

  return (
    <div>
      <p>Get lifetime Pro access for $249. {remaining} of 100 spots remaining.</p>
      <Button>Claim Lifetime Deal</Button>
    </div>
  );
}
```

## Property Locking

### On Trial Expiry

```typescript
async function lockExcessProperties(userId: string): Promise<void> {
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
    orderBy: asc(properties.createdAt),
  });

  // Lock all except the first property
  const propertiesToLock = userProperties.slice(1);

  if (propertiesToLock.length > 0) {
    await db
      .update(properties)
      .set({ locked: true })
      .where(inArray(properties.id, propertiesToLock.map(p => p.id)));
  }
}
```

### On Subscription Activation

```typescript
async function unlockAllProperties(userId: string): Promise<void> {
  await db
    .update(properties)
    .set({ locked: false })
    .where(eq(properties.userId, userId));
}
```

### Property Query Filtering

```typescript
// For free users, filter out locked properties
if (userPlan === 'free') {
  return db.query.properties.findMany({
    where: and(
      eq(properties.userId, userId),
      eq(properties.locked, false)
    ),
  });
}
```

### UI for Locked Properties

- Show in sidebar with lock icon, greyed out
- Click shows modal: "Subscribe to unlock this property"
- Property data preserved, just not accessible

## Trial Reminders

### In-App Banner

Component: `src/components/billing/TrialBanner.tsx`

```typescript
export function TrialBanner({ trialEndsAt }: { trialEndsAt: Date }) {
  const daysLeft = differenceInDays(trialEndsAt, new Date());

  if (daysLeft > 7) return null;

  return (
    <div className="bg-yellow-50 border-yellow-200 p-4">
      Your Pro trial ends in {daysLeft} days.
      <Button>Add payment method</Button>
    </div>
  );
}
```

### Email Reminders

Add notification type: `'trial_reminder'`

| Trigger | Subject |
|---------|---------|
| 3 days left | "Your PropertyTracker trial ends in 3 days" |
| 1 day left | "Last day of your Pro trial" |
| Trial ended | "Your Pro trial has ended" |

### Cron Job

Route: `src/app/api/cron/trial-reminders/route.ts`

```typescript
export async function GET(req: Request) {
  // Verify cron secret

  const now = new Date();
  const threeDaysFromNow = addDays(now, 3);
  const oneDayFromNow = addDays(now, 1);

  // Find users with trials ending in 3 days
  const threeDayUsers = await db.query.users.findMany({
    where: and(
      gte(users.trialEndsAt, startOfDay(threeDaysFromNow)),
      lt(users.trialEndsAt, endOfDay(threeDaysFromNow))
    ),
  });

  // Send 3-day reminder emails...

  // Find users with trials ending in 1 day
  const oneDayUsers = await db.query.users.findMany({
    where: and(
      gte(users.trialEndsAt, startOfDay(oneDayFromNow)),
      lt(users.trialEndsAt, endOfDay(oneDayFromNow))
    ),
  });

  // Send 1-day reminder emails...

  // Find users with trials that ended today
  const expiredUsers = await db.query.users.findMany({
    where: and(
      lt(users.trialEndsAt, now),
      isNull(users.trialEndedAt) // Not yet processed
    ),
  });

  // Lock properties and send trial-ended emails...

  return NextResponse.json({ processed: true });
}
```

## Files to Modify

| Area | Files |
|------|-------|
| Database | `drizzle/0023_trial_and_lifetime.sql` |
| Schema | `src/server/db/schema.ts` - users, properties, subscriptions |
| Auth/Signup | `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` or Clerk webhook |
| Access control | `src/server/services/subscription.ts` |
| Billing router | `src/server/routers/billing.ts` |
| Stripe webhook | `src/app/api/webhooks/stripe/route.ts` |
| Billing page | `src/app/(dashboard)/settings/billing/page.tsx` |
| Trial banner | `src/components/billing/TrialBanner.tsx` (new) |
| Cron job | `src/app/api/cron/trial-reminders/route.ts` (new) |
| Landing page | `src/components/landing/LifetimeBanner.tsx` |
| Notification service | `src/server/services/notification.ts` |

## Out of Scope

- Proration for mid-cycle plan changes (Stripe handles automatically)
- Refund handling
- Coupon/discount codes
- Team seat management beyond existing implementation
