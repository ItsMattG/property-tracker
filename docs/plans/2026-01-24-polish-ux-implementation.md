# Polish & UX Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve new user experience with onboarding wizard and setup checklist, enhance navigation with quick-add button, breadcrumbs, and property selector.

**Architecture:** New userOnboarding table tracks wizard/checklist state. Onboarding router provides progress data. UI components: slide-out wizard panel, dashboard checklist widget, header quick-add dropdown, breadcrumbs, and property selector dropdown.

**Tech Stack:** Drizzle ORM, tRPC, React, Tailwind CSS, Radix UI (via shadcn), Lucide icons, Vitest

---

## Task 1: Add userOnboarding Schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add userOnboarding table to schema**

Add after `connectionAlerts` table (around line 444):

```typescript
export const userOnboarding = pgTable("user_onboarding", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  wizardDismissedAt: timestamp("wizard_dismissed_at"),
  checklistDismissedAt: timestamp("checklist_dismissed_at"),
  completedSteps: text("completed_steps").array().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 2: Add userOnboarding relations**

Add after `connectionAlertsRelations`:

```typescript
export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(users, {
    fields: [userOnboarding.userId],
    references: [users.id],
  }),
}));
```

**Step 3: Add type exports**

Add at end of type exports section:

```typescript
export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type NewUserOnboarding = typeof userOnboarding.$inferInsert;
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat: add userOnboarding table schema

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Onboarding Service

**Files:**
- Create: `src/server/services/onboarding.ts`
- Create: `src/server/services/__tests__/onboarding.test.ts`

**Step 1: Write failing tests for onboarding service**

Create `src/server/services/__tests__/onboarding.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ONBOARDING_STEPS,
  getStepStatus,
  calculateProgress,
  isStepComplete,
} from "../onboarding";

describe("onboarding service", () => {
  describe("ONBOARDING_STEPS", () => {
    it("should have 5 defined steps", () => {
      expect(ONBOARDING_STEPS).toHaveLength(5);
    });

    it("should have correct step IDs", () => {
      const ids = ONBOARDING_STEPS.map((s) => s.id);
      expect(ids).toEqual([
        "add_property",
        "connect_bank",
        "categorize_10",
        "setup_recurring",
        "add_property_value",
      ]);
    });
  });

  describe("isStepComplete", () => {
    it("returns true when count meets threshold", () => {
      expect(isStepComplete("add_property", { propertyCount: 1 })).toBe(true);
      expect(isStepComplete("categorize_10", { categorizedCount: 10 })).toBe(true);
    });

    it("returns false when count below threshold", () => {
      expect(isStepComplete("add_property", { propertyCount: 0 })).toBe(false);
      expect(isStepComplete("categorize_10", { categorizedCount: 9 })).toBe(false);
    });
  });

  describe("getStepStatus", () => {
    it("returns complete status for finished steps", () => {
      const counts = { propertyCount: 2, bankAccountCount: 1 };
      const status = getStepStatus("add_property", counts);
      expect(status.isComplete).toBe(true);
    });

    it("returns incomplete status with action link", () => {
      const counts = { propertyCount: 0 };
      const status = getStepStatus("add_property", counts);
      expect(status.isComplete).toBe(false);
      expect(status.actionLink).toBe("/properties/new");
    });
  });

  describe("calculateProgress", () => {
    it("returns 0/5 when nothing complete", () => {
      const counts = {
        propertyCount: 0,
        bankAccountCount: 0,
        categorizedCount: 0,
        recurringCount: 0,
        propertyValueCount: 0,
      };
      const progress = calculateProgress(counts);
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(5);
    });

    it("returns correct count when some complete", () => {
      const counts = {
        propertyCount: 1,
        bankAccountCount: 1,
        categorizedCount: 5,
        recurringCount: 0,
        propertyValueCount: 0,
      };
      const progress = calculateProgress(counts);
      expect(progress.completed).toBe(2);
    });

    it("returns 5/5 when all complete", () => {
      const counts = {
        propertyCount: 1,
        bankAccountCount: 1,
        categorizedCount: 10,
        recurringCount: 1,
        propertyValueCount: 1,
      };
      const progress = calculateProgress(counts);
      expect(progress.completed).toBe(5);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/__tests__/onboarding.test.ts`
Expected: FAIL - module not found

**Step 3: Implement onboarding service**

Create `src/server/services/onboarding.ts`:

```typescript
export interface OnboardingStep {
  id: string;
  label: string;
  actionLink: string;
  threshold: number;
  countKey: keyof OnboardingCounts;
}

export interface OnboardingCounts {
  propertyCount: number;
  bankAccountCount: number;
  categorizedCount: number;
  recurringCount: number;
  propertyValueCount: number;
}

export interface StepStatus {
  id: string;
  label: string;
  isComplete: boolean;
  actionLink: string;
}

export interface OnboardingProgress {
  completed: number;
  total: number;
  steps: StepStatus[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "add_property",
    label: "Add a property",
    actionLink: "/properties/new",
    threshold: 1,
    countKey: "propertyCount",
  },
  {
    id: "connect_bank",
    label: "Connect your bank",
    actionLink: "/banking/connect",
    threshold: 1,
    countKey: "bankAccountCount",
  },
  {
    id: "categorize_10",
    label: "Categorize 10 transactions",
    actionLink: "/transactions",
    threshold: 10,
    countKey: "categorizedCount",
  },
  {
    id: "setup_recurring",
    label: "Set up recurring transaction",
    actionLink: "/properties",
    threshold: 1,
    countKey: "recurringCount",
  },
  {
    id: "add_property_value",
    label: "Add property value estimate",
    actionLink: "/portfolio",
    threshold: 1,
    countKey: "propertyValueCount",
  },
];

export function isStepComplete(
  stepId: string,
  counts: Partial<OnboardingCounts>
): boolean {
  const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!step) return false;
  const count = counts[step.countKey] ?? 0;
  return count >= step.threshold;
}

export function getStepStatus(
  stepId: string,
  counts: Partial<OnboardingCounts>
): StepStatus {
  const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!step) {
    return { id: stepId, label: "", isComplete: false, actionLink: "" };
  }
  return {
    id: step.id,
    label: step.label,
    isComplete: isStepComplete(stepId, counts),
    actionLink: step.actionLink,
  };
}

export function calculateProgress(counts: OnboardingCounts): OnboardingProgress {
  const steps = ONBOARDING_STEPS.map((step) => getStepStatus(step.id, counts));
  const completed = steps.filter((s) => s.isComplete).length;
  return {
    completed,
    total: ONBOARDING_STEPS.length,
    steps,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/onboarding.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/server/services/onboarding.ts src/server/services/__tests__/onboarding.test.ts
git commit -m "feat: add onboarding service with step tracking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Onboarding Router

**Files:**
- Create: `src/server/routers/onboarding.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create onboarding router**

Create `src/server/routers/onboarding.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  userOnboarding,
  properties,
  bankAccounts,
  transactions,
  recurringTransactions,
  propertyValues,
} from "../db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { calculateProgress, type OnboardingCounts } from "../services/onboarding";

export const onboardingRouter = router({
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    // Get or create onboarding record
    let onboarding = await ctx.db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, ctx.user.id),
    });

    if (!onboarding) {
      const [created] = await ctx.db
        .insert(userOnboarding)
        .values({ userId: ctx.user.id })
        .returning();
      onboarding = created;
    }

    // Get counts in parallel
    const [
      propertyResult,
      bankAccountResult,
      categorizedResult,
      recurringResult,
      propertyValueResult,
    ] = await Promise.all([
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(properties)
        .where(eq(properties.userId, ctx.user.id)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, ctx.user.id)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ctx.user.id),
            ne(transactions.category, "uncategorized")
          )
        ),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(recurringTransactions)
        .where(eq(recurringTransactions.userId, ctx.user.id)),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(propertyValues)
        .where(eq(propertyValues.userId, ctx.user.id)),
    ]);

    const counts: OnboardingCounts = {
      propertyCount: propertyResult[0]?.count ?? 0,
      bankAccountCount: bankAccountResult[0]?.count ?? 0,
      categorizedCount: categorizedResult[0]?.count ?? 0,
      recurringCount: recurringResult[0]?.count ?? 0,
      propertyValueCount: propertyValueResult[0]?.count ?? 0,
    };

    const progress = calculateProgress(counts);

    return {
      ...onboarding,
      progress,
      showWizard: !onboarding.wizardDismissedAt && counts.propertyCount === 0,
      showChecklist:
        !onboarding.checklistDismissedAt && progress.completed < progress.total,
    };
  }),

  dismissWizard: protectedProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(userOnboarding)
      .set({
        wizardDismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, ctx.user.id))
      .returning();

    return updated;
  }),

  dismissChecklist: protectedProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(userOnboarding)
      .set({
        checklistDismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, ctx.user.id))
      .returning();

    return updated;
  }),

  markStepComplete: protectedProcedure
    .input(z.object({ stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const onboarding = await ctx.db.query.userOnboarding.findFirst({
        where: eq(userOnboarding.userId, ctx.user.id),
      });

      if (!onboarding) return null;

      const currentSteps = onboarding.completedSteps || [];
      if (currentSteps.includes(input.stepId)) {
        return onboarding;
      }

      const [updated] = await ctx.db
        .update(userOnboarding)
        .set({
          completedSteps: [...currentSteps, input.stepId],
          updatedAt: new Date(),
        })
        .where(eq(userOnboarding.userId, ctx.user.id))
        .returning();

      return updated;
    }),
});
```

**Step 2: Register router in app router**

Modify `src/server/routers/_app.ts`:

Add import:
```typescript
import { onboardingRouter } from "./onboarding";
```

Add to router object:
```typescript
onboarding: onboardingRouter,
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/onboarding.ts src/server/routers/_app.ts
git commit -m "feat: add onboarding router with progress tracking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create OnboardingWizard Component

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`

**Step 1: Create OnboardingWizard component**

Create `src/components/onboarding/OnboardingWizard.tsx`:

```typescript
"use client";

import { useState } from "react";
import { X, ChevronRight, Building2, Landmark, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";

interface OnboardingWizardProps {
  onClose: () => void;
}

type WizardStep = "welcome" | "property" | "bank" | "done";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

export function OnboardingWizard({ onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [propertyData, setPropertyData] = useState({
    address: "",
    suburb: "",
    state: "" as (typeof STATES)[number] | "",
    postcode: "",
    purchasePrice: "",
    purchaseDate: "",
  });
  const router = useRouter();
  const utils = trpc.useUtils();

  const createProperty = trpc.property.create.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
      setStep("bank");
    },
  });

  const dismissWizard = trpc.onboarding.dismissWizard.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
      onClose();
    },
  });

  const handlePropertySubmit = async () => {
    if (!propertyData.address || !propertyData.state) return;
    await createProperty.mutateAsync({
      address: propertyData.address,
      suburb: propertyData.suburb,
      state: propertyData.state,
      postcode: propertyData.postcode,
      purchasePrice: propertyData.purchasePrice || "0",
      purchaseDate: propertyData.purchaseDate || new Date().toISOString().split("T")[0],
    });
  };

  const handleSkip = () => {
    if (step === "welcome") setStep("property");
    else if (step === "property") setStep("bank");
    else if (step === "bank") setStep("done");
  };

  const handleClose = () => {
    dismissWizard.mutate();
  };

  const handleFinish = () => {
    dismissWizard.mutate();
  };

  const handleConnectBank = () => {
    dismissWizard.mutate();
    router.push("/banking/connect");
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card z-50 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Get Started</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "welcome" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Welcome to PropertyTracker</h3>
                <p className="text-muted-foreground">
                  Let's set up your portfolio in 3 quick steps. You can always
                  add more details later.
                </p>
              </div>
              <div className="space-y-3">
                <StepIndicator step={1} label="Add your first property" active />
                <StepIndicator step={2} label="Connect your bank" />
                <StepIndicator step={3} label="You're ready!" />
              </div>
            </div>
          )}

          {step === "property" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Add Your First Property</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the basic details. You can add more information later.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    placeholder="123 Main Street"
                    value={propertyData.address}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, address: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="suburb">Suburb</Label>
                    <Input
                      id="suburb"
                      placeholder="Sydney"
                      value={propertyData.suburb}
                      onChange={(e) =>
                        setPropertyData({ ...propertyData, suburb: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={propertyData.state}
                      onValueChange={(value) =>
                        setPropertyData({
                          ...propertyData,
                          state: value as (typeof STATES)[number],
                        })
                      }
                    >
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    placeholder="2000"
                    value={propertyData.postcode}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, postcode: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      placeholder="500000"
                      value={propertyData.purchasePrice}
                      onChange={(e) =>
                        setPropertyData({
                          ...propertyData,
                          purchasePrice: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={propertyData.purchaseDate}
                      onChange={(e) =>
                        setPropertyData({
                          ...propertyData,
                          purchaseDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "bank" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Landmark className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Connect Your Bank</h3>
                <p className="text-muted-foreground">
                  Automatically import transactions from your bank account.
                  We use Basiq to securely connect to your bank.
                </p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">You're All Set!</h3>
                <p className="text-muted-foreground">
                  Your PropertyTracker is ready. Check out your dashboard to
                  see your portfolio summary.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-between">
          {step !== "done" && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
          )}
          {step === "welcome" && (
            <Button onClick={() => setStep("property")}>
              Get Started
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "property" && (
            <Button
              onClick={handlePropertySubmit}
              disabled={
                !propertyData.address ||
                !propertyData.suburb ||
                !propertyData.state ||
                !propertyData.postcode ||
                createProperty.isPending
              }
            >
              {createProperty.isPending ? "Saving..." : "Continue"}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "bank" && (
            <Button onClick={handleConnectBank}>
              Connect Bank
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "done" && (
            <Button onClick={handleFinish} className="ml-auto">
              View Dashboard
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function StepIndicator({
  step,
  label,
  active = false,
  complete = false,
}: {
  step: number;
  label: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
          active && "bg-primary text-primary-foreground",
          complete && "bg-green-600 text-white",
          !active && !complete && "bg-muted text-muted-foreground"
        )}
      >
        {complete ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span className={cn(active ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/onboarding/OnboardingWizard.tsx
git commit -m "feat: add OnboardingWizard slide-out panel component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create SetupChecklist Component

**Files:**
- Create: `src/components/onboarding/SetupChecklist.tsx`

**Step 1: Create SetupChecklist component**

Create `src/components/onboarding/SetupChecklist.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import type { StepStatus } from "@/server/services/onboarding";

interface SetupChecklistProps {
  progress: {
    completed: number;
    total: number;
    steps: StepStatus[];
  };
}

export function SetupChecklist({ progress }: SetupChecklistProps) {
  const utils = trpc.useUtils();

  const dismissChecklist = trpc.onboarding.dismissChecklist.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
    },
  });

  const progressPercent = (progress.completed / progress.total) * 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Setup Progress</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => dismissChecklist.mutate()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {progress.completed} of {progress.total} complete
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressPercent} className="h-2" />

        <div className="space-y-2">
          {progress.steps.map((step) => (
            <ChecklistItem key={step.id} step={step} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistItem({ step }: { step: StepStatus }) {
  return (
    <Link
      href={step.actionLink}
      className={cn(
        "flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors",
        step.isComplete && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
            step.isComplete
              ? "border-green-600 bg-green-600"
              : "border-muted-foreground"
          )}
        >
          {step.isComplete && <Check className="w-3 h-3 text-white" />}
        </div>
        <span
          className={cn(
            "text-sm",
            step.isComplete && "line-through text-muted-foreground"
          )}
        >
          {step.label}
        </span>
      </div>
      {!step.isComplete && (
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      )}
    </Link>
  );
}
```

**Step 2: Create Progress UI component if missing**

Check if `src/components/ui/progress.tsx` exists. If not, create it:

```typescript
"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```

**Step 3: Install radix progress if needed**

Run: `npm install @radix-ui/react-progress`

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/onboarding/SetupChecklist.tsx src/components/ui/progress.tsx
git commit -m "feat: add SetupChecklist dashboard widget component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create QuickAddButton Component

**Files:**
- Create: `src/components/layout/QuickAddButton.tsx`
- Create: `src/components/transactions/AddTransactionDialog.tsx`

**Step 1: Create AddTransactionDialog component**

Create `src/components/transactions/AddTransactionDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "rental_income", label: "Rental Income" },
  { value: "advertising", label: "Advertising" },
  { value: "body_corporate", label: "Body Corporate" },
  { value: "cleaning", label: "Cleaning" },
  { value: "council_rates", label: "Council Rates" },
  { value: "insurance", label: "Insurance" },
  { value: "interest_on_loans", label: "Interest on Loans" },
  { value: "property_agent_fees", label: "Property Agent Fees" },
  { value: "repairs_and_maintenance", label: "Repairs & Maintenance" },
  { value: "water_charges", label: "Water Charges" },
  { value: "personal", label: "Personal" },
  { value: "uncategorized", label: "Uncategorized" },
] as const;

const TRANSACTION_TYPES = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "capital", label: "Capital" },
  { value: "transfer", label: "Transfer" },
  { value: "personal", label: "Personal" },
] as const;

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionDialog({
  open,
  onOpenChange,
}: AddTransactionDialogProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    propertyId: "",
    category: "uncategorized" as string,
    transactionType: "expense" as string,
  });

  const utils = trpc.useUtils();
  const { data: properties } = trpc.property.list.useQuery();

  const createTransaction = trpc.transaction.create.useMutation({
    onSuccess: () => {
      toast.success("Transaction added");
      utils.transaction.list.invalidate();
      utils.stats.dashboard.invalidate();
      utils.onboarding.getProgress.invalidate();
      onOpenChange(false);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        propertyId: "",
        category: "uncategorized",
        transactionType: "expense",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTransaction.mutate({
      date: formData.date,
      description: formData.description,
      amount: formData.amount,
      propertyId: formData.propertyId || undefined,
      category: formData.category as typeof CATEGORIES[number]["value"],
      transactionType: formData.transactionType as typeof TRANSACTION_TYPES[number]["value"],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Rent payment, repairs, etc."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Select
              value={formData.propertyId}
              onValueChange={(value) =>
                setFormData({ ...formData, propertyId: value })
              }
            >
              <SelectTrigger id="property">
                <SelectValue placeholder="Select property (optional)" />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.suburb}, {property.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.transactionType}
                onValueChange={(value) =>
                  setFormData({ ...formData, transactionType: value })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? "Adding..." : "Add Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create QuickAddButton component**

Create `src/components/layout/QuickAddButton.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Plus, Building2, ArrowLeftRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import { useRouter } from "next/navigation";

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="rounded-full h-9 w-9">
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Quick Add <kbd className="ml-auto text-xs">⌘K</kbd>
          </div>
          <DropdownMenuItem onClick={() => router.push("/properties/new")}>
            <Building2 className="mr-2 h-4 w-4" />
            Add Property
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTransactionDialogOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Add Transaction
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/loans/new")}>
            <Banknote className="mr-2 h-4 w-4" />
            Add Loan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddTransactionDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
      />
    </>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/QuickAddButton.tsx src/components/transactions/AddTransactionDialog.tsx
git commit -m "feat: add QuickAddButton with keyboard shortcut and transaction dialog

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create Breadcrumb Component

**Files:**
- Create: `src/components/layout/Breadcrumb.tsx`

**Step 1: Create Breadcrumb component**

Create `src/components/layout/Breadcrumb.tsx`:

```typescript
"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center text-sm", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground" />
          )}
          {item.href && index < items.length - 1 ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className={cn(
                index === items.length - 1
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/Breadcrumb.tsx
git commit -m "feat: add Breadcrumb navigation component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Create PropertySelector Component

**Files:**
- Create: `src/components/layout/PropertySelector.tsx`

**Step 1: Create PropertySelector component**

Create `src/components/layout/PropertySelector.tsx`:

```typescript
"use client";

import { ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc/client";
import { useRouter, usePathname } from "next/navigation";

interface PropertySelectorProps {
  currentPropertyId: string;
  currentPropertyName: string;
}

export function PropertySelector({
  currentPropertyId,
  currentPropertyName,
}: PropertySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: properties } = trpc.property.list.useQuery();

  const handlePropertySelect = (propertyId: string) => {
    // Get current sub-route (e.g., /properties/[id]/capital -> /capital)
    const pathParts = pathname.split("/");
    const subRoute = pathParts.slice(3).join("/"); // Get everything after /properties/[id]
    const newPath = subRoute
      ? `/properties/${propertyId}/${subRoute}`
      : `/properties/${propertyId}`;
    router.push(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 font-medium">
          <Building2 className="h-4 w-4" />
          {currentPropertyName}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {properties?.map((property) => (
          <DropdownMenuItem
            key={property.id}
            onClick={() => handlePropertySelect(property.id)}
            className={property.id === currentPropertyId ? "bg-accent" : ""}
          >
            <div>
              <div className="font-medium">
                {property.suburb}, {property.state}
              </div>
              <div className="text-xs text-muted-foreground">
                {property.address}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/PropertySelector.tsx
git commit -m "feat: add PropertySelector dropdown for property navigation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Update Header with QuickAddButton

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Update Header component**

Modify `src/components/layout/Header.tsx`:

```typescript
"use client";

import { UserButton } from "@clerk/nextjs";
import { QuickAddButton } from "./QuickAddButton";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>
      <div className="flex items-center gap-4">
        <QuickAddButton />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add QuickAddButton to header

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Update Dashboard with Onboarding Components

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Update dashboard page**

Modify `src/app/(dashboard)/dashboard/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeftRight, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";

export default function DashboardPage() {
  const [wizardClosed, setWizardClosed] = useState(false);
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();
  const { data: alerts } = trpc.banking.listAlerts.useQuery();
  const { data: onboarding } = trpc.onboarding.getProgress.useQuery();
  const utils = trpc.useUtils();

  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onSuccess: () => {
      utils.banking.listAlerts.invalidate();
    },
  });

  const handleDismissAllAlerts = async () => {
    if (!alerts) return;
    for (const alert of alerts) {
      await dismissAlert.mutateAsync({ alertId: alert.id });
    }
  };

  const hasAuthError = alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

  const showWizard = onboarding?.showWizard && !wizardClosed;
  const showChecklist = onboarding?.showChecklist;

  return (
    <div className="space-y-6">
      {showWizard && (
        <OnboardingWizard onClose={() => setWizardClosed(true)} />
      )}

      {alerts && alerts.length > 0 && (
        <ConnectionAlertBanner
          alertCount={alerts.length}
          hasAuthError={hasAuthError}
          onDismiss={handleDismissAllAlerts}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold">Welcome to PropertyTracker</h2>
        <p className="text-muted-foreground">
          Track your investment properties, automate bank feeds, and generate tax reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {showChecklist && onboarding?.progress && (
          <div className="md:col-span-3">
            <SetupChecklist progress={onboarding.progress} />
          </div>
        )}

        <Link href="/properties">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Properties</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  stats?.propertyCount ?? 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.propertyCount === 0
                  ? "Add your first property to get started"
                  : "Investment properties tracked"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/transactions">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  stats?.transactionCount ?? 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.transactionCount === 0
                  ? "Connect your bank to import transactions"
                  : "Total transactions imported"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/transactions?category=uncategorized">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Uncategorized
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                ) : (
                  stats?.uncategorizedCount ?? 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.uncategorizedCount === 0
                  ? "All transactions categorized!"
                  : "Transactions needing review"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: integrate onboarding wizard and checklist into dashboard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Add Breadcrumbs to Property Detail Pages

**Files:**
- Create: `src/app/(dashboard)/properties/[id]/layout.tsx`

**Step 1: Create property detail layout with breadcrumbs**

Create `src/app/(dashboard)/properties/[id]/layout.tsx`:

```typescript
"use client";

import { useParams, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { PropertySelector } from "@/components/layout/PropertySelector";

export default function PropertyDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const propertyId = params.id as string;

  const { data: property } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: "Properties", href: "/properties" },
    ];

    if (property) {
      const propertyLabel = `${property.address}, ${property.suburb}`;

      // Check for sub-routes
      if (pathname.includes("/capital")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Capital Gains" });
      } else if (pathname.includes("/recurring")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Recurring" });
      } else if (pathname.includes("/documents")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Documents" });
      } else if (pathname.includes("/edit")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Edit" });
      } else {
        items.push({ label: propertyLabel });
      }
    }

    return items;
  };

  const propertyName = property
    ? `${property.suburb}, ${property.state}`
    : "Loading...";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Breadcrumb items={getBreadcrumbItems()} />
        {property && (
          <PropertySelector
            currentPropertyId={propertyId}
            currentPropertyName={propertyName}
          />
        )}
      </div>
      {children}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/layout.tsx
git commit -m "feat: add breadcrumbs and property selector to property detail pages

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Run All Tests

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Final commit if any fixes needed**

If tests or type checks fail, fix issues and commit:

```bash
git add -A
git commit -m "fix: resolve test/type issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan creates:

1. **userOnboarding table** - Tracks wizard/checklist state per user
2. **Onboarding service** - Business logic for step completion
3. **Onboarding router** - tRPC endpoints for progress tracking
4. **OnboardingWizard** - Slide-out panel for new users (4 steps)
5. **SetupChecklist** - Dashboard widget showing 5-step progress
6. **QuickAddButton** - Header dropdown with Cmd/Ctrl+K shortcut
7. **AddTransactionDialog** - Modal for manual transaction entry
8. **Breadcrumb** - Navigation component for property pages
9. **PropertySelector** - Dropdown to switch between properties

All components integrate with existing tRPC infrastructure and follow established patterns.
