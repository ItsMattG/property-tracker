# Trial Email Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement welcome email on signup, property limit warnings (email, modal, toast, banner) for trial users adding multiple properties.

**Architecture:** Server-side email sending via Resend (existing infrastructure). Client-side notifications via shadcn Dialog and sonner toast. Dashboard banner as conditional React component. All trial/subscription checks use existing database queries.

**Tech Stack:** Next.js, tRPC, Resend, shadcn/ui (Dialog), sonner (toast), Drizzle ORM

---

## Task 1: Welcome Email Template

**Files:**
- Create: `src/lib/email/templates/welcome.ts`

**Step 1: Create the welcome email template**

```typescript
import { baseTemplate } from "./base";
import { format } from "date-fns";

export function welcomeEmailSubject(): string {
  return "Welcome to BrickTrack! Your 14-day Pro trial is active";
}

export function welcomeEmailTemplate({
  name,
  trialEndsAt,
}: {
  name: string | null;
  trialEndsAt: Date;
}): string {
  const greeting = name ? `Hi ${name}!` : "Hi!";
  const trialEndDate = format(trialEndsAt, "MMMM d, yyyy");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au";

  const content = `
    <h2 style="color: #2563eb; margin: 0 0 20px 0;">Welcome to BrickTrack!</h2>
    <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      You now have <strong>full Pro access for 14 days</strong> - no credit card required.
    </p>
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0;">
      Your trial ends on <strong>${trialEndDate}</strong>.
    </p>

    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
      <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 16px;">Quick Start:</h3>
      <ol style="margin: 0; padding-left: 20px; color: #374151;">
        <li style="margin-bottom: 8px;">Add your first investment property</li>
        <li style="margin-bottom: 8px;">Connect your bank for automatic transaction import</li>
        <li style="margin-bottom: 8px;">Track rental income and expenses effortlessly</li>
      </ol>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/properties/new"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Add Your First Property
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0;">
      <a href="${appUrl}/settings/billing" style="color: #2563eb;">Explore all Pro features</a>
    </p>
  `;
  return baseTemplate(content);
}
```

**Step 2: Commit**

```bash
git add src/lib/email/templates/welcome.ts
git commit -m "feat(email): add welcome email template"
```

---

## Task 2: Property Limit Warning Email Template

**Files:**
- Create: `src/lib/email/templates/property-limit-warning.ts`

**Step 1: Create the property limit warning email template**

```typescript
import { baseTemplate } from "./base";
import { format, differenceInDays } from "date-fns";

export function propertyLimitWarningSubject(): string {
  return "Quick heads up about your BrickTrack properties";
}

export function propertyLimitWarningTemplate({
  name,
  trialEndsAt,
}: {
  name: string | null;
  trialEndsAt: Date;
}): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const trialEndDate = format(trialEndsAt, "MMMM d, yyyy");
  const daysRemaining = differenceInDays(trialEndsAt, new Date());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au";

  const content = `
    <h2 style="color: #f59e0b; margin: 0 0 20px 0;">You've added your 2nd property!</h2>
    <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      Nice work building your portfolio! Your 14-day Pro trial gives you unlimited properties.
    </p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      <strong>Quick heads up:</strong> After your trial ends on ${trialEndDate}, only your first property stays active.
    </p>

    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
      <h4 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;">What happens to other properties?</h4>
      <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px;">
        <li style="margin-bottom: 4px;">Your data is preserved (nothing is deleted)</li>
        <li style="margin-bottom: 4px;">Properties become "dormant" - view-only, no new transactions</li>
        <li style="margin-bottom: 4px;">Upgrade anytime to reactivate all properties</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/settings/billing"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Upgrade to Pro - $14/month
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0;">
      No pressure - you still have ${daysRemaining} days to decide.
    </p>
  `;
  return baseTemplate(content);
}
```

**Step 2: Commit**

```bash
git add src/lib/email/templates/property-limit-warning.ts
git commit -m "feat(email): add property limit warning email template"
```

---

## Task 3: Send Welcome Email on Signup

**Files:**
- Modify: `src/app/api/webhooks/clerk/route.ts`

**Step 1: Add imports at top of file**

Add after line 6 (`import { eq } from "drizzle-orm";`):

```typescript
import { sendEmailNotification } from "@/server/services/notification";
import {
  welcomeEmailSubject,
  welcomeEmailTemplate,
} from "@/lib/email/templates/welcome";
```

**Step 2: Send welcome email after user creation**

After line 84 (`console.log("User created/updated with 14-day Pro trial:", id);`), add:

```typescript
      // Send welcome email (don't fail webhook if email fails)
      const trialEndsAt = addDays(now, 14);
      try {
        await sendEmailNotification(
          primaryEmail.email_address,
          welcomeEmailSubject(),
          welcomeEmailTemplate({
            name,
            trialEndsAt,
          })
        );
        console.log("Welcome email sent to:", primaryEmail.email_address);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
```

**Step 3: Commit**

```bash
git add src/app/api/webhooks/clerk/route.ts
git commit -m "feat(email): send welcome email on user signup"
```

---

## Task 4: Send Property Limit Email on 2nd Property

**Files:**
- Modify: `src/server/routers/property.ts`

**Step 1: Add imports at top of file**

Add after line 7 (`import { getPlanFromSubscription, PLAN_LIMITS } from "../services/subscription";`):

```typescript
import { users } from "../db/schema";
import { sendEmailNotification } from "../services/notification";
import {
  propertyLimitWarningSubject,
  propertyLimitWarningTemplate,
} from "@/lib/email/templates/property-limit-warning";
```

**Step 2: Add function to check if user is on trial**

Add before `export const propertyRouter = router({` (around line 18):

```typescript
async function isUserOnTrial(
  db: typeof import("../db").db,
  userId: string
): Promise<{ onTrial: boolean; trialEndsAt: Date | null; email: string | null; name: string | null }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.trialEndsAt) {
    return { onTrial: false, trialEndsAt: null, email: null, name: null };
  }

  const now = new Date();
  const hasActiveSub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, "active")
    ),
  });

  if (hasActiveSub) {
    return { onTrial: false, trialEndsAt: null, email: null, name: null };
  }

  return {
    onTrial: user.trialEndsAt > now,
    trialEndsAt: user.trialEndsAt,
    email: user.email,
    name: user.name,
  };
}
```

**Step 3: Send email when 2nd property is created**

In the `create` mutation, after the referral check block (after line 181 `}`), add:

```typescript
      // Send property limit warning email when user adds their 2nd property during trial
      try {
        const trialInfo = await isUserOnTrial(ctx.db, ctx.portfolio.ownerId);
        if (trialInfo.onTrial && propertyCount?.count === 2 && trialInfo.email && trialInfo.trialEndsAt) {
          await sendEmailNotification(
            trialInfo.email,
            propertyLimitWarningSubject(),
            propertyLimitWarningTemplate({
              name: trialInfo.name,
              trialEndsAt: trialInfo.trialEndsAt,
            })
          );
        }
      } catch {
        // Non-critical — don't fail property creation
      }
```

**Step 4: Commit**

```bash
git add src/server/routers/property.ts
git commit -m "feat(email): send property limit warning on 2nd property"
```

---

## Task 5: Trial Property Limit Modal Component

**Files:**
- Create: `src/components/modals/TrialPropertyLimitModal.tsx`

**Step 1: Create the modal component**

```typescript
"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TrialPropertyLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  trialEndsAt: Date;
  isLoading?: boolean;
}

export function TrialPropertyLimitModal({
  open,
  onOpenChange,
  onConfirm,
  trialEndsAt,
  isLoading,
}: TrialPropertyLimitModalProps) {
  const trialEndDate = format(trialEndsAt, "MMMM d, yyyy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adding your 2nd property</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p>
                Great news - your Pro trial lets you track unlimited properties!
              </p>
              <p>
                Just a heads up: after your trial ends on{" "}
                <strong>{trialEndDate}</strong>, only your first property stays
                active. The rest become dormant (data preserved, just view-only).
              </p>
              <p>You can upgrade anytime to keep everything active.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" asChild>
            <Link href="/settings/billing" target="_blank">
              View Pro pricing
            </Link>
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Adding..." : "Got it, add property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/modals/TrialPropertyLimitModal.tsx
git commit -m "feat(ui): add trial property limit modal component"
```

---

## Task 6: Add tRPC Query for Trial Status

**Files:**
- Modify: `src/server/routers/billing.ts`

**Step 1: Read the billing router to understand structure**

Run: Read `src/server/routers/billing.ts`

**Step 2: Add getTrialStatus procedure**

Add a new procedure to get trial status and property count:

```typescript
  getTrialStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.portfolio.ownerId),
    });

    if (!user || !user.trialEndsAt) {
      return { isOnTrial: false, trialEndsAt: null, propertyCount: 0 };
    }

    const now = new Date();
    const hasActiveSub = await ctx.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, ctx.portfolio.ownerId),
        eq(subscriptions.status, "active")
      ),
    });

    if (hasActiveSub) {
      return { isOnTrial: false, trialEndsAt: null, propertyCount: 0 };
    }

    const [countResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.userId, ctx.portfolio.ownerId));

    return {
      isOnTrial: user.trialEndsAt > now,
      trialEndsAt: user.trialEndsAt,
      propertyCount: countResult?.count ?? 0,
    };
  }),
```

**Step 3: Add necessary imports if not present**

Ensure these imports exist at top of file:
- `users` from schema
- `properties` from schema
- `sql` from drizzle-orm
- `and` from drizzle-orm

**Step 4: Commit**

```bash
git add src/server/routers/billing.ts
git commit -m "feat(api): add getTrialStatus procedure for trial/property info"
```

---

## Task 7: Integrate Modal and Toast in Property Creation Page

**Files:**
- Modify: `src/app/(dashboard)/properties/new/page.tsx`

**Step 1: Update the page with modal and toast logic**

Replace entire file content:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyForm, type PropertyFormValues } from "@/components/properties/PropertyForm";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/useTour";
import { TrialPropertyLimitModal } from "@/components/modals/TrialPropertyLimitModal";
import { toast } from "sonner";

export default function NewPropertyPage() {
  const router = useRouter();
  useTour({ tourId: "add-property" });

  const [showTrialModal, setShowTrialModal] = useState(false);
  const [pendingValues, setPendingValues] = useState<PropertyFormValues | null>(null);

  const { data: trialStatus } = trpc.billing.getTrialStatus.useQuery();

  const createProperty = trpc.property.create.useMutation({
    onSuccess: (property) => {
      // Show toast for 3rd+ property during trial
      if (trialStatus?.isOnTrial && trialStatus.propertyCount >= 2) {
        toast.info("Reminder: Only your first property stays active after your trial", {
          action: {
            label: "Upgrade",
            onClick: () => router.push("/settings/billing"),
          },
          duration: 5000,
        });
      }
      router.push(`/properties/${property.id}/settlement`);
    },
  });

  const handleSubmit = async (values: PropertyFormValues) => {
    // Check if this will be the 2nd property for a trial user
    if (trialStatus?.isOnTrial && trialStatus.propertyCount === 1) {
      setPendingValues(values);
      setShowTrialModal(true);
      return;
    }

    await createProperty.mutateAsync(values);
  };

  const handleModalConfirm = async () => {
    if (pendingValues) {
      await createProperty.mutateAsync(pendingValues);
      setShowTrialModal(false);
      setPendingValues(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/properties">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Property</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyForm
            onSubmit={handleSubmit}
            isLoading={createProperty.isPending}
          />
        </CardContent>
      </Card>

      {trialStatus?.trialEndsAt && (
        <TrialPropertyLimitModal
          open={showTrialModal}
          onOpenChange={setShowTrialModal}
          onConfirm={handleModalConfirm}
          trialEndsAt={trialStatus.trialEndsAt}
          isLoading={createProperty.isPending}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/properties/new/page.tsx
git commit -m "feat(ui): add trial modal and toast to property creation"
```

---

## Task 8: Trial Property Limit Banner Component

**Files:**
- Create: `src/components/banners/TrialPropertyLimitBanner.tsx`

**Step 1: Create the banner component**

```typescript
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TrialPropertyLimitBannerProps {
  propertyCount: number;
  trialEndsAt: Date;
}

export function TrialPropertyLimitBanner({
  propertyCount,
  trialEndsAt,
}: TrialPropertyLimitBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const trialEndDate = format(trialEndsAt, "MMMM d");

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-800">
            You have <strong>{propertyCount} properties</strong> on your trial.
            After <strong>{trialEndDate}</strong>, only your first property stays
            active. Upgrade to keep them all.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" asChild>
            <Link href="/settings/billing">Upgrade to Pro</Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-600 hover:text-amber-800 p-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/banners/TrialPropertyLimitBanner.tsx
git commit -m "feat(ui): add trial property limit banner component"
```

---

## Task 9: Add Banner to Dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Read the DashboardClient to understand structure**

Run: Read `src/components/dashboard/DashboardClient.tsx`

**Step 2: Add trial status query and banner**

Add import at top:
```typescript
import { TrialPropertyLimitBanner } from "@/components/banners/TrialPropertyLimitBanner";
```

Add query inside component:
```typescript
const { data: trialStatus } = trpc.billing.getTrialStatus.useQuery();
```

Add banner rendering at the start of the return JSX (before other content):
```typescript
{trialStatus?.isOnTrial && trialStatus.propertyCount >= 2 && trialStatus.trialEndsAt && (
  <TrialPropertyLimitBanner
    propertyCount={trialStatus.propertyCount}
    trialEndsAt={trialStatus.trialEndsAt}
  />
)}
```

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(ui): add trial property limit banner to dashboard"
```

---

## Task 10: Final Testing and PR

**Step 1: Run type check**

Run: `npm run type-check` (or `npx tsc --noEmit`)
Expected: No type errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No lint errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Push and create PR**

```bash
git push -u origin feature/trial-email-notifications
gh pr create --title "feat: trial email notifications and property limit warnings" --body "## Summary
- Welcome email sent on user signup
- Property limit warning email sent when adding 2nd property during trial
- Modal shown when adding 2nd property (requires acknowledgment)
- Toast shown when adding 3rd+ property (gentle reminder)
- Dashboard banner for trial users with 2+ properties

## Test plan
- [ ] Sign up new user - verify welcome email received
- [ ] Add 2nd property during trial - verify modal appears and email sent
- [ ] Add 3rd property - verify toast appears
- [ ] Visit dashboard with 2+ properties on trial - verify banner shows
- [ ] Dismiss banner - verify it stays dismissed for session
- [ ] Upgrade to Pro - verify no warnings shown

Generated with [Claude Code](https://claude.ai/claude-code)"
```

---

## Success Criteria

- [ ] Welcome email sent within seconds of signup
- [ ] 2nd property triggers modal + email
- [ ] 3rd+ property triggers toast
- [ ] Dashboard shows banner for trial users with 2+ properties
- [ ] No notifications for users with active paid subscriptions
- [ ] All TypeScript types pass
- [ ] Build succeeds
