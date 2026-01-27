# Guided Onboarding Flow - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing sidebar onboarding wizard with a full-screen enhanced wizard, and add Driver.js-powered contextual page tours with auto-trigger on first visit and a persistent help button.

**Architecture:** Two-part system — (1) EnhancedWizard full-screen modal with inline property form and progress bar, replacing the existing OnboardingWizard; (2) Driver.js page tours on 5 key pages, tracked via new DB columns, with a useTour hook managing auto-launch and completion state.

**Tech Stack:** Next.js 16 App Router, shadcn/ui, tRPC, Drizzle ORM, Driver.js, Vitest

---

### Task 1: Database Migration — Add Tour Tracking Columns

**Files:**
- Create: `drizzle/0018_onboarding_tours.sql`
- Modify: `src/server/db/schema.ts` (lines 2016-2027, userOnboarding table)

**Step 1: Create migration file**

```sql
-- drizzle/0018_onboarding_tours.sql
ALTER TABLE "user_onboarding" ADD COLUMN "completed_tours" text[] DEFAULT '{}' NOT NULL;
ALTER TABLE "user_onboarding" ADD COLUMN "tours_disabled" boolean DEFAULT false NOT NULL;
```

**Step 2: Update Drizzle schema**

In `src/server/db/schema.ts`, add two columns to the `userOnboarding` table definition, after line 2024 (`completedSteps`):

```typescript
completedTours: text("completed_tours").array().default([]).notNull(),
toursDisabled: boolean("tours_disabled").default(false).notNull(),
```

Add `boolean` to the drizzle-orm/pg-core import if not already there.

**Step 3: Run migration**

Run: `npx drizzle-kit push`
Expected: Schema updated with new columns.

**Step 4: Commit**

```bash
git add drizzle/0018_onboarding_tours.sql src/server/db/schema.ts
git commit -m "feat(onboarding): add tour tracking columns to user_onboarding"
```

---

### Task 2: tRPC Tour Procedures

**Files:**
- Modify: `src/server/routers/onboarding.ts`

**Step 1: Add completeTour mutation**

Add after the `markStepComplete` procedure (line 133):

```typescript
completeTour: writeProcedure
  .input(z.object({ tourId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const onboarding = await ctx.db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, ctx.portfolio.ownerId),
    });

    if (!onboarding) return null;

    const currentTours = onboarding.completedTours || [];
    if (currentTours.includes(input.tourId)) {
      return onboarding;
    }

    const [updated] = await ctx.db
      .update(userOnboarding)
      .set({
        completedTours: [...currentTours, input.tourId],
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, ctx.portfolio.ownerId))
      .returning();

    return updated;
  }),

disableTours: writeProcedure.mutation(async ({ ctx }) => {
  const [updated] = await ctx.db
    .update(userOnboarding)
    .set({
      toursDisabled: true,
      updatedAt: new Date(),
    })
    .where(eq(userOnboarding.userId, ctx.portfolio.ownerId))
    .returning();

  return updated;
}),
```

**Step 2: Update getProgress to return tour state**

In the `getProgress` procedure return object (around line 74), add tour fields:

```typescript
return {
  ...onboarding,
  progress,
  showWizard: !onboarding.wizardDismissedAt && counts.propertyCount === 0,
  showChecklist:
    !onboarding.checklistDismissedAt && progress.completed < progress.total,
  completedTours: onboarding.completedTours || [],
  toursDisabled: onboarding.toursDisabled ?? false,
};
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/server/routers/onboarding.ts
git commit -m "feat(onboarding): add tour completion and disable tRPC procedures"
```

---

### Task 3: Install Driver.js

**Files:**
- Modify: `package.json`

**Step 1: Install**

Run: `npm install driver.js`

**Step 2: Verify install**

Run: `ls node_modules/driver.js/dist/`
Expected: driver.js dist files present.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(onboarding): add driver.js dependency for page tours"
```

---

### Task 4: Tour Definition Files

**Files:**
- Create: `src/config/tours/dashboard.ts`
- Create: `src/config/tours/add-property.ts`
- Create: `src/config/tours/banking.ts`
- Create: `src/config/tours/transactions.ts`
- Create: `src/config/tours/portfolio.ts`
- Create: `src/config/tours/index.ts`

**Step 1: Create tour type and index**

```typescript
// src/config/tours/index.ts
import type { DriveStep } from "driver.js";

export interface TourDefinition {
  id: string;
  steps: DriveStep[];
}

export { dashboardTour } from "./dashboard";
export { addPropertyTour } from "./add-property";
export { bankingTour } from "./banking";
export { transactionsTour } from "./transactions";
export { portfolioTour } from "./portfolio";

export const TOUR_PAGE_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/properties/new": "add-property",
  "/banking/connect": "banking",
  "/transactions": "transactions",
  "/portfolio": "portfolio",
};
```

**Step 2: Create dashboard tour**

```typescript
// src/config/tours/dashboard.ts
import type { TourDefinition } from "./index";

export const dashboardTour: TourDefinition = {
  id: "dashboard",
  steps: [
    {
      element: "[data-tour='sidebar-nav']",
      popover: {
        title: "Navigation",
        description: "Navigate between properties, banking, transactions, and reports.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "[data-tour='portfolio-summary']",
      popover: {
        title: "Portfolio Overview",
        description: "Your total portfolio value and equity at a glance.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='setup-checklist']",
      popover: {
        title: "Setup Progress",
        description: "Track your progress here. Complete all steps to get the most out of PropertyTracker.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='quick-actions']",
      popover: {
        title: "Quick Actions",
        description: "Add properties, record expenses, or view reports from here.",
        side: "bottom",
        align: "start",
      },
    },
  ],
};
```

**Step 3: Create add-property tour**

```typescript
// src/config/tours/add-property.ts
import type { TourDefinition } from "./index";

export const addPropertyTour: TourDefinition = {
  id: "add-property",
  steps: [
    {
      element: "[data-tour='address-field']",
      popover: {
        title: "Property Address",
        description: "Start typing to search. We'll auto-fill suburb, state, and postcode.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='purchase-details']",
      popover: {
        title: "Purchase Details",
        description: "Used for capital gains calculations and equity tracking.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='property-type']",
      popover: {
        title: "Property Type",
        description: "This determines which compliance rules and tax categories apply.",
        side: "top",
        align: "start",
      },
    },
  ],
};
```

**Step 4: Create banking tour**

```typescript
// src/config/tours/banking.ts
import type { TourDefinition } from "./index";

export const bankingTour: TourDefinition = {
  id: "banking",
  steps: [
    {
      element: "[data-tour='basiq-connect']",
      popover: {
        title: "Connect Your Bank",
        description: "Securely connect your bank. Read-only access with bank-level encryption.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='linked-accounts']",
      popover: {
        title: "Linked Accounts",
        description: "Your connected accounts appear here. Transactions sync automatically.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='sender-allowlist']",
      popover: {
        title: "Email Allowlist",
        description: "Allow emails from your property manager to auto-match invoices.",
        side: "top",
        align: "start",
      },
    },
  ],
};
```

**Step 5: Create transactions tour**

```typescript
// src/config/tours/transactions.ts
import type { TourDefinition } from "./index";

export const transactionsTour: TourDefinition = {
  id: "transactions",
  steps: [
    {
      element: "[data-tour='transaction-list']",
      popover: {
        title: "Transactions",
        description: "Imported transactions from your connected banks appear here.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='category-dropdown']",
      popover: {
        title: "Categories",
        description: "Categorize each transaction for accurate tax reporting.",
        side: "left",
        align: "start",
      },
    },
    {
      element: "[data-tour='bulk-actions']",
      popover: {
        title: "Bulk Actions",
        description: "Select multiple transactions to categorize or assign in bulk.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='filters']",
      popover: {
        title: "Filters",
        description: "Filter by property, category, date range, or status.",
        side: "bottom",
        align: "start",
      },
    },
  ],
};
```

**Step 6: Create portfolio tour**

```typescript
// src/config/tours/portfolio.ts
import type { TourDefinition } from "./index";

export const portfolioTour: TourDefinition = {
  id: "portfolio",
  steps: [
    {
      element: "[data-tour='property-cards']",
      popover: {
        title: "Your Properties",
        description: "Each property shows current value, equity, and growth.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='avm-estimates']",
      popover: {
        title: "Automated Valuations",
        description: "Automated valuations update monthly from market data.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='portfolio-summary']",
      popover: {
        title: "Portfolio Summary",
        description: "Your combined portfolio value, debt, and equity position.",
        side: "bottom",
        align: "start",
      },
    },
  ],
};
```

**Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 8: Commit**

```bash
git add src/config/tours/
git commit -m "feat(onboarding): add tour definitions for 5 key pages"
```

---

### Task 5: useTour Hook

**Files:**
- Create: `src/hooks/useTour.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/useTour.ts
"use client";

import { useEffect, useRef, useCallback } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { trpc } from "@/lib/trpc/client";
import {
  dashboardTour,
  addPropertyTour,
  bankingTour,
  transactionsTour,
  portfolioTour,
  type TourDefinition,
} from "@/config/tours";

const TOUR_MAP: Record<string, TourDefinition> = {
  dashboard: dashboardTour,
  "add-property": addPropertyTour,
  banking: bankingTour,
  transactions: transactionsTour,
  portfolio: portfolioTour,
};

interface UseTourOptions {
  tourId: string;
  autoStart?: boolean;
}

export function useTour({ tourId, autoStart = true }: UseTourOptions) {
  const driverRef = useRef<Driver | null>(null);
  const hasAutoStarted = useRef(false);
  const utils = trpc.useUtils();

  const { data: onboarding } = trpc.onboarding.getProgress.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const completeTour = trpc.onboarding.completeTour.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
    },
  });

  const disableTours = trpc.onboarding.disableTours.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
    },
  });

  const isTourComplete = onboarding?.completedTours?.includes(tourId) ?? false;
  const isToursDisabled = onboarding?.toursDisabled ?? false;

  const startTour = useCallback(() => {
    const tourDef = TOUR_MAP[tourId];
    if (!tourDef) return;

    // Filter steps to only those with existing elements
    const validSteps = tourDef.steps.filter((step) => {
      if (!step.element) return true;
      return document.querySelector(step.element as string);
    });

    if (validSteps.length === 0) return;

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      popoverOffset: 10,
      steps: validSteps,
      onDestroyStarted: () => {
        completeTour.mutate({ tourId });
        driverInstance.destroy();
      },
      onNextClick: () => {
        if (!driverInstance.hasNextStep()) {
          completeTour.mutate({ tourId });
          driverInstance.destroy();
        } else {
          driverInstance.moveNext();
        }
      },
      popoverClass: "property-tracker-tour",
    });

    driverRef.current = driverInstance;
    driverInstance.drive();
  }, [tourId, completeTour]);

  const disableAllTours = useCallback(() => {
    disableTours.mutate();
    if (driverRef.current) {
      driverRef.current.destroy();
    }
  }, [disableTours]);

  // Auto-start tour on first visit
  useEffect(() => {
    if (
      !autoStart ||
      !onboarding ||
      isTourComplete ||
      isToursDisabled ||
      hasAutoStarted.current
    ) {
      return;
    }

    hasAutoStarted.current = true;
    const timer = setTimeout(() => {
      startTour();
    }, 500);

    return () => clearTimeout(timer);
  }, [autoStart, onboarding, isTourComplete, isToursDisabled, startTour]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  return {
    startTour,
    isTourComplete,
    isToursDisabled,
    disableAllTours,
  };
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/hooks/useTour.ts
git commit -m "feat(onboarding): add useTour hook for Driver.js page tours"
```

---

### Task 6: HelpButton Component

**Files:**
- Create: `src/components/onboarding/HelpButton.tsx`
- Modify: `src/components/layout/Header.tsx`

**Step 1: Create HelpButton**

```typescript
// src/components/onboarding/HelpButton.tsx
"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useTour } from "@/hooks/useTour";
import { TOUR_PAGE_MAP } from "@/config/tours";

export function HelpButton() {
  const pathname = usePathname();
  const tourId = TOUR_PAGE_MAP[pathname];

  const { startTour } = useTour({
    tourId: tourId || "",
    autoStart: false,
  });

  if (!tourId) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startTour}
      title="Take a tour of this page"
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}
```

**Step 2: Add HelpButton to Header**

In `src/components/layout/Header.tsx`, add import and render:

```typescript
import { HelpButton } from "@/components/onboarding/HelpButton";
```

Add `<HelpButton />` in the header's right-side div, before `<AlertBadge />`:

```typescript
<div className="flex items-center gap-4">
  <HelpButton />
  <AlertBadge />
  <WhatsNewButton onClick={() => setDrawerOpen(true)} />
  <QuickAddButton />
  <UserButton afterSignOutUrl="/" />
</div>
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/components/onboarding/HelpButton.tsx src/components/layout/Header.tsx
git commit -m "feat(onboarding): add help button to header for page tours"
```

---

### Task 7: EnhancedWizard Component

**Files:**
- Create: `src/components/onboarding/EnhancedWizard.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx` (swap import)

**Step 1: Create EnhancedWizard**

```typescript
// src/components/onboarding/EnhancedWizard.tsx
"use client";

import { useState } from "react";
import {
  X,
  ChevronRight,
  Building2,
  Landmark,
  CheckCircle2,
  Circle,
  Minus,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";

interface EnhancedWizardProps {
  onClose: () => void;
}

type WizardStep = "welcome" | "property" | "bank" | "done";

const STEPS: WizardStep[] = ["welcome", "property", "bank", "done"];
const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

const STEP_LABELS: Record<WizardStep, string> = {
  welcome: "Welcome",
  property: "Add Property",
  bank: "Connect Bank",
  done: "All Set",
};

export function EnhancedWizard({ onClose }: EnhancedWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [propertyAdded, setPropertyAdded] = useState(false);
  const [propertyData, setPropertyData] = useState({
    address: "",
    suburb: "",
    state: "" as (typeof STATES)[number] | "",
    postcode: "",
    purchasePrice: "",
    purchaseDate: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();

  const createProperty = trpc.property.create.useMutation({
    onSuccess: () => {
      utils.onboarding.getProgress.invalidate();
      setPropertyAdded(true);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setStep("bank");
      }, 1500);
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
      purchaseDate:
        propertyData.purchaseDate || new Date().toISOString().split("T")[0],
    });
  };

  const handleSkip = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]);
    }
  };

  const handleClose = () => {
    dismissWizard.mutate();
  };

  const handleConnectBank = () => {
    dismissWizard.mutate();
    router.push("/banking/connect");
  };

  const handleFinish = () => {
    dismissWizard.mutate();
  };

  const currentStepIndex = STEPS.indexOf(step);
  const progressPercent = (currentStepIndex / (STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    "text-xs",
                    i <= currentStepIndex
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {i > 0 && <span className="mx-1 text-muted-foreground">·</span>}
                  {STEP_LABELS[s]}
                </span>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === "welcome" && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Welcome to PropertyTracker</h2>
                <p className="text-muted-foreground">
                  Track your properties, automate expenses, and optimize your tax
                  position.
                </p>
              </div>
              <div className="space-y-3 text-left max-w-xs mx-auto">
                <StepPreview step={1} label="Add your first property" />
                <StepPreview step={2} label="Connect your bank" />
                <StepPreview step={3} label="You're ready!" />
              </div>
            </div>
          )}

          {step === "property" && !showSuccess && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Add Your First Property</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the basic details. You can add more information later.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wiz-address">Street Address</Label>
                  <Input
                    id="wiz-address"
                    placeholder="123 Main Street"
                    value={propertyData.address}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, address: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wiz-suburb">Suburb</Label>
                    <Input
                      id="wiz-suburb"
                      placeholder="Sydney"
                      value={propertyData.suburb}
                      onChange={(e) =>
                        setPropertyData({ ...propertyData, suburb: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wiz-state">State</Label>
                    <Select
                      value={propertyData.state}
                      onValueChange={(value) =>
                        setPropertyData({
                          ...propertyData,
                          state: value as (typeof STATES)[number],
                        })
                      }
                    >
                      <SelectTrigger id="wiz-state">
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
                  <Label htmlFor="wiz-postcode">Postcode</Label>
                  <Input
                    id="wiz-postcode"
                    placeholder="2000"
                    value={propertyData.postcode}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, postcode: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wiz-price">Purchase Price</Label>
                    <Input
                      id="wiz-price"
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
                    <Label htmlFor="wiz-date">Purchase Date</Label>
                    <Input
                      id="wiz-date"
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

          {step === "property" && showSuccess && (
            <div className="space-y-6 text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">Property Added!</h2>
              <p className="text-muted-foreground">Moving to the next step...</p>
            </div>
          )}

          {step === "bank" && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Landmark className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Connect Your Bank</h2>
                <p className="text-muted-foreground">
                  Automatically import transactions from your bank account. We use
                  Basiq to securely connect to your bank.
                </p>
              </div>
              <div className="space-y-3 text-left max-w-xs mx-auto">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-sm">Bank-level encryption</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-sm">Read-only access to transactions</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-sm">Automatic transaction imports</span>
                </div>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">You're All Set!</h2>
                <p className="text-muted-foreground">
                  Here's what you've done and what's next.
                </p>
              </div>
              <div className="space-y-2 max-w-xs mx-auto">
                <CompletionItem
                  label="Add a property"
                  status={propertyAdded ? "done" : "skipped"}
                />
                <CompletionItem label="Connect your bank" status="skipped" />
                <div className="pt-2 border-t mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Still to do:</p>
                  <CompletionItem label="Categorize 10 transactions" status="pending" />
                  <CompletionItem label="Set up recurring transaction" status="pending" />
                  <CompletionItem label="Add property value estimate" status="pending" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-between items-center">
          {step !== "welcome" && step !== "done" && (
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip for now
            </Button>
          )}
          {step === "welcome" && <div />}
          {step === "done" && <div />}

          {step === "welcome" && (
            <Button onClick={() => setStep("property")}>
              Get Started
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === "property" && !showSuccess && (
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
              {createProperty.isPending ? "Saving..." : "Save & Continue"}
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
              Go to Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepPreview({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
        {step}
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function CompletionItem({
  label,
  status,
}: {
  label: string;
  status: "done" | "skipped" | "pending";
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      {status === "done" && (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      )}
      {status === "skipped" && (
        <Minus className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      {status === "pending" && (
        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <span
        className={cn(
          "text-sm",
          status === "done" && "text-foreground",
          status === "skipped" && "text-muted-foreground",
          status === "pending" && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
```

**Step 2: Swap OnboardingWizard for EnhancedWizard in DashboardClient**

In `src/components/dashboard/DashboardClient.tsx`, change the import on line 9:

Replace:
```typescript
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
```
With:
```typescript
import { EnhancedWizard } from "@/components/onboarding/EnhancedWizard";
```

Replace usage on line 84:
```typescript
<OnboardingWizard onClose={() => setWizardClosed(true)} />
```
With:
```typescript
<EnhancedWizard onClose={() => setWizardClosed(true)} />
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/components/onboarding/EnhancedWizard.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat(onboarding): add enhanced full-screen wizard with inline property form"
```

---

### Task 8: Add data-tour Attributes to Pages

Add `data-tour` attributes to existing page elements so Driver.js can target them. This involves small, targeted edits to existing components.

**Files:**
- Modify: Sidebar component (find via `data-tour='sidebar-nav'`)
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/components/onboarding/SetupChecklist.tsx`
- Modify: Property form, banking, transactions, and portfolio pages as needed

**Step 1: Find and identify the sidebar, property form, banking, transactions, and portfolio page components**

Use Explore agent to find exact elements to tag with `data-tour` attributes on each of the 5 pages. Each page needs the attributes matching its tour definition.

Dashboard needs:
- `data-tour="sidebar-nav"` on the sidebar nav element
- `data-tour="portfolio-summary"` on the first stats card row
- `data-tour="setup-checklist"` on the SetupChecklist wrapper
- `data-tour="quick-actions"` on the QuickAddButton or header actions area

Properties/new needs:
- `data-tour="address-field"` on address input wrapper
- `data-tour="purchase-details"` on purchase price/date section
- `data-tour="property-type"` on entity/type selector

Banking/connect needs:
- `data-tour="basiq-connect"` on connect button
- `data-tour="linked-accounts"` on accounts list
- `data-tour="sender-allowlist"` on allowlist section

Transactions needs:
- `data-tour="transaction-list"` on main table
- `data-tour="category-dropdown"` on first category cell or header
- `data-tour="bulk-actions"` on bulk action toolbar
- `data-tour="filters"` on filter bar

Portfolio needs:
- `data-tour="property-cards"` on property cards grid
- `data-tour="avm-estimates"` on AVM section
- `data-tour="portfolio-summary"` on summary section

**Step 2: Add attributes to dashboard components**

In `src/components/dashboard/DashboardClient.tsx`, wrap the stats grid (line 109) with a data-tour:
```typescript
<div data-tour="portfolio-summary" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
```

Wrap the SetupChecklist (line 105-107):
```typescript
<div data-tour="setup-checklist">
  {showChecklist && onboarding?.progress && (
    <SetupChecklist progress={onboarding.progress} />
  )}
</div>
```

Note: Only render `data-tour="setup-checklist"` div when `showChecklist` is true.

**Step 3: Add attributes to other pages**

Add `data-tour` attributes to the relevant elements in each page component. These are simple single-attribute additions to existing JSX elements. Find each element and add the attribute.

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add data-tour attributes to page elements for Driver.js tours"
```

---

### Task 9: Wire Up Auto-Start Tours on Pages

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: Properties new page component
- Modify: Banking connect page component
- Modify: Transactions page component
- Modify: Portfolio page component

**Step 1: Add useTour to DashboardClient**

In `src/components/dashboard/DashboardClient.tsx`, add:

```typescript
import { useTour } from "@/hooks/useTour";
```

Inside the component, after existing hooks, add:

```typescript
// Auto-start dashboard tour after wizard is dismissed
useTour({
  tourId: "dashboard",
  autoStart: !showWizard,
});
```

**Step 2: Add useTour to other 4 page components**

For each page, add a single `useTour` call at the top of the client component:

Properties new:
```typescript
useTour({ tourId: "add-property" });
```

Banking connect:
```typescript
useTour({ tourId: "banking" });
```

Transactions:
```typescript
useTour({ tourId: "transactions" });
```

Portfolio:
```typescript
useTour({ tourId: "portfolio" });
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): wire up auto-start tours on 5 key pages"
```

---

### Task 10: Manual Testing & Polish

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test wizard flow**

1. Create a new test user (or clear onboarding state in DB)
2. Verify full-screen wizard appears on dashboard
3. Walk through all 4 steps: welcome → add property (inline) → connect bank → done
4. Verify property is created
5. Verify wizard dismisses and shows SetupChecklist

**Step 3: Test tours**

1. After wizard dismissal, verify dashboard tour auto-launches
2. Navigate to `/properties/new` — verify add-property tour launches
3. Navigate to `/banking/connect` — verify banking tour launches
4. Navigate to `/transactions` — verify transactions tour launches
5. Navigate to `/portfolio` — verify portfolio tour launches
6. Revisit any page — verify tour does NOT re-launch
7. Click "?" help button — verify tour re-launches on demand

**Step 4: Test edge cases**

1. Dismiss wizard mid-flow (click X on step 2) — verify checklist appears
2. Skip all wizard steps — verify done screen shows skipped items
3. Verify help button is hidden on pages without tours (e.g., `/settings`)

**Step 5: Fix any issues found**

Address CSS, positioning, or z-index issues. Driver.js may need `popoverOffset` tweaks for specific elements.

**Step 6: Final commit**

```bash
git add -A
git commit -m "fix(onboarding): polish wizard and tour styling"
```

---

### Task 11: Create PR

**Step 1: Push and create PR**

```bash
git push -u origin feature/guided-onboarding
gh pr create --title "feat(onboarding): Guided onboarding with enhanced wizard and page tours" --body "$(cat <<'EOF'
## Summary
- Replaced sidebar onboarding wizard with full-screen enhanced wizard (inline property form, progress bar, completion summary)
- Added Driver.js contextual page tours on 5 key pages (Dashboard, Add Property, Banking, Transactions, Portfolio)
- Tours auto-trigger on first visit, with "?" help button to re-trigger
- Tour completion tracked in DB (completedTours array, toursDisabled flag)

## Test plan
- [ ] New user sees enhanced wizard on first dashboard visit
- [ ] Wizard inline property form creates property successfully
- [ ] Wizard "Connect Bank" redirects to banking page
- [ ] Dashboard tour auto-launches after wizard dismissal
- [ ] All 5 page tours launch on first visit
- [ ] Tours don't re-launch on subsequent visits
- [ ] Help button re-triggers tour on demand
- [ ] Help button hidden on pages without tours
- [ ] Wizard skip/dismiss works correctly
- [ ] Mobile layout works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
