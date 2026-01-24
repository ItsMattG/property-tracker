# Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve application performance through data caching, optimistic UI updates, React Server Components, and lazy loading.

**Architecture:** Configure React Query with sensible caching defaults, add optimistic updates for common mutations, convert Dashboard to use server-side data fetching, and lazy load chart components.

**Tech Stack:** React Query, tRPC, Next.js dynamic imports, React Server Components

---

## Task 1: Configure QueryClient Caching

**Files:**
- Modify: `src/lib/trpc/Provider.tsx`

**Step 1: Update QueryClient configuration**

Replace the current QueryClient initialization with caching defaults:

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "./client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // Data fresh for 30 seconds
            gcTime: 5 * 60 * 1000, // Keep in cache 5 minutes
            refetchOnWindowFocus: false, // Don't refetch on tab switch
            retry: 1, // Only retry once on failure
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Step 2: Verify locally**

Run: `npm run dev`
Navigate between pages and verify data is cached (no loading spinners on back navigation).

**Step 3: Commit**

```bash
git add src/lib/trpc/Provider.tsx
git commit -m "perf: configure QueryClient with caching defaults"
```

---

## Task 2: Add Optimistic Updates to Transactions Page

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`

**Step 1: Update mutations with optimistic updates**

Replace the current mutations with optimistic update versions. Find the mutations section (around line 50-60) and replace with:

```typescript
  const utils = trpc.useUtils();

  const updateCategory = trpc.transaction.updateCategory.useMutation({
    onMutate: async (newData) => {
      await utils.transaction.list.cancel();
      const queryKey = {
        propertyId: filters.propertyId,
        category: filters.category as any,
        startDate: filters.startDate,
        endDate: filters.endDate,
        isVerified: filters.isVerified,
        limit: PAGE_SIZE,
        offset,
      };
      const previous = utils.transaction.list.getData(queryKey);

      utils.transaction.list.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === newData.id ? { ...t, category: newData.category } : t
          ),
        };
      });

      return { previous, queryKey };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.transaction.list.setData(context.queryKey, context.previous);
      }
    },
    onSettled: () => {
      utils.transaction.list.invalidate();
    },
  });

  const bulkUpdateCategory = trpc.transaction.bulkUpdateCategory.useMutation({
    onSuccess: () => utils.transaction.list.invalidate(),
  });

  const toggleVerified = trpc.transaction.toggleVerified.useMutation({
    onMutate: async (newData) => {
      await utils.transaction.list.cancel();
      const queryKey = {
        propertyId: filters.propertyId,
        category: filters.category as any,
        startDate: filters.startDate,
        endDate: filters.endDate,
        isVerified: filters.isVerified,
        limit: PAGE_SIZE,
        offset,
      };
      const previous = utils.transaction.list.getData(queryKey);

      utils.transaction.list.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          transactions: old.transactions.map((t) =>
            t.id === newData.id ? { ...t, isVerified: !t.isVerified } : t
          ),
        };
      });

      return { previous, queryKey };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.transaction.list.setData(context.queryKey, context.previous);
      }
    },
    onSettled: () => {
      utils.transaction.list.invalidate();
    },
  });
```

**Step 2: Remove refetch() calls from handlers**

Update the handler functions to not await the mutation (let optimistic update handle UI):

```typescript
  const handleCategoryChange = (
    id: string,
    category: string,
    propertyId?: string
  ) => {
    updateCategory.mutate({
      id,
      category: category as any,
      propertyId,
    });
  };

  const handleBulkCategoryChange = async (ids: string[], category: string) => {
    await bulkUpdateCategory.mutateAsync({
      ids,
      category: category as any,
    });
  };

  const handleToggleVerified = (id: string) => {
    toggleVerified.mutate({ id });
  };
```

**Step 3: Verify locally**

Run: `npm run dev`
Test: Change a transaction category - should update instantly without loading state.
Test: Toggle verified checkbox - should toggle instantly.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/transactions/page.tsx
git commit -m "perf: add optimistic updates to transaction mutations"
```

---

## Task 3: Add Optimistic Updates to Dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Update dismissAlert mutation**

Find the dismissAlert mutation (around line 19) and replace with optimistic version:

```typescript
  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onMutate: async (newData) => {
      await utils.banking.listAlerts.cancel();
      const previous = utils.banking.listAlerts.getData();

      utils.banking.listAlerts.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((alert) => alert.id !== newData.alertId);
      });

      return { previous };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.banking.listAlerts.setData(undefined, context.previous);
      }
    },
    onSettled: () => {
      utils.banking.listAlerts.invalidate();
    },
  });
```

**Step 2: Verify locally**

Run: `npm run dev`
Test: If there are alerts, clicking dismiss should remove them instantly.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "perf: add optimistic update to alert dismissal"
```

---

## Task 4: Create Server-Side tRPC Caller

**Files:**
- Create: `src/lib/trpc/server.ts`
- Modify: `src/server/trpc.ts`

**Step 1: Export createCallerFactory from trpc.ts**

Add this export at the end of `src/server/trpc.ts`:

```typescript
export const createCallerFactory = t.createCallerFactory;
```

**Step 2: Create server-side caller utility**

Create `src/lib/trpc/server.ts`:

```typescript
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

const createCaller = createCallerFactory(appRouter);

export async function getServerTRPC() {
  const { userId } = await auth();

  return createCaller({
    db,
    clerkId: userId,
  });
}
```

**Step 3: Verify it compiles**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 4: Commit**

```bash
git add src/server/trpc.ts src/lib/trpc/server.ts
git commit -m "feat: add server-side tRPC caller utility"
```

---

## Task 5: Convert Dashboard to RSC

**Files:**
- Create: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create DashboardClient component**

Create `src/components/dashboard/DashboardClient.tsx` with the current dashboard logic:

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

interface DashboardStats {
  propertyCount: number;
  transactionCount: number;
  uncategorizedCount: number;
}

interface DashboardClientProps {
  initialStats: DashboardStats | null;
}

export function DashboardClient({ initialStats }: DashboardClientProps) {
  const [wizardClosed, setWizardClosed] = useState(false);
  const utils = trpc.useUtils();

  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery(undefined, {
    initialData: initialStats ?? undefined,
    staleTime: 60_000, // Dashboard stats can be stale for 1 minute
  });

  const { data: alerts } = trpc.banking.listAlerts.useQuery(undefined, {
    staleTime: 10_000, // Alerts should be fresher
  });

  const { data: onboarding } = trpc.onboarding.getProgress.useQuery(undefined, {
    staleTime: 5 * 60_000, // Onboarding rarely changes
  });

  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onMutate: async (newData) => {
      await utils.banking.listAlerts.cancel();
      const previous = utils.banking.listAlerts.getData();

      utils.banking.listAlerts.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((alert) => alert.id !== newData.alertId);
      });

      return { previous };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        utils.banking.listAlerts.setData(undefined, context.previous);
      }
    },
    onSettled: () => {
      utils.banking.listAlerts.invalidate();
    },
  });

  const handleDismissAllAlerts = async () => {
    if (!alerts) return;
    for (const alert of alerts) {
      await dismissAlert.mutateAsync({ alertId: alert.id });
    }
  };

  const hasAuthError =
    alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

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
          Track your investment properties, automate bank feeds, and generate
          tax reports.
        </p>
      </div>

      {showChecklist && onboarding?.progress && (
        <SetupChecklist progress={onboarding.progress} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <CardTitle className="text-sm font-medium">
                Transactions
              </CardTitle>
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

**Step 2: Convert dashboard page to Server Component**

Replace `src/app/(dashboard)/dashboard/page.tsx` with:

```typescript
import { getServerTRPC } from "@/lib/trpc/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  let initialStats = null;

  try {
    const trpc = await getServerTRPC();
    initialStats = await trpc.stats.dashboard();
  } catch {
    // User might not be authenticated yet, client will handle
  }

  return <DashboardClient initialStats={initialStats} />;
}
```

**Step 3: Verify locally**

Run: `npm run dev`
Test: Dashboard should load with stats visible immediately (no loading spinner for stats on initial load).

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "perf: convert dashboard to RSC with server-side data fetching"
```

---

## Task 6: Lazy Load Chart Components

**Files:**
- Modify: `src/components/portfolio/AggregatedView.tsx`
- Modify: `src/app/(dashboard)/reports/portfolio/page.tsx`

**Step 1: Update AggregatedView to lazy load charts**

At the top of `src/components/portfolio/AggregatedView.tsx`, replace the chart imports with dynamic imports:

```typescript
"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Building2, DollarSign, TrendingUp, Percent, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

const EquityDonutChart = dynamic(
  () =>
    import("./EquityDonutChart").then((m) => ({ default: m.EquityDonutChart })),
  {
    loading: () => (
      <div className="h-[300px] bg-muted animate-pulse rounded" />
    ),
    ssr: false,
  }
);

const CashFlowBarChart = dynamic(
  () =>
    import("./CashFlowBarChart").then((m) => ({ default: m.CashFlowBarChart })),
  {
    loading: () => (
      <div className="h-[300px] bg-muted animate-pulse rounded" />
    ),
    ssr: false,
  }
);
```

Remove the original imports:
```typescript
// DELETE THESE LINES:
// import { EquityDonutChart } from "./EquityDonutChart";
// import { CashFlowBarChart } from "./CashFlowBarChart";
```

**Step 2: Update reports/portfolio page to lazy load CashFlowChart**

At the top of `src/app/(dashboard)/reports/portfolio/page.tsx`, replace the CashFlowChart import:

```typescript
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Loader2,
} from "lucide-react";

const CashFlowChart = dynamic(
  () =>
    import("@/components/reports/CashFlowChart").then((m) => ({
      default: m.CashFlowChart,
    })),
  {
    loading: () => (
      <div className="h-[300px] bg-muted animate-pulse rounded" />
    ),
    ssr: false,
  }
);
```

Remove the original import:
```typescript
// DELETE THIS LINE:
// import { CashFlowChart } from "@/components/reports/CashFlowChart";
```

**Step 3: Verify locally**

Run: `npm run build && npm run start`
Test: Check bundle size - charts should be in separate chunks.
Test: Portfolio aggregate view should show loading placeholder then charts.

**Step 4: Commit**

```bash
git add src/components/portfolio/AggregatedView.tsx src/app/(dashboard)/reports/portfolio/page.tsx
git commit -m "perf: lazy load chart components to reduce initial bundle"
```

---

## Task 7: Run Tests and Push

**Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass.

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Push changes**

```bash
git push origin feature/infrastructure
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | Provider.tsx | Configure QueryClient caching defaults |
| 2 | transactions/page.tsx | Optimistic updates for category/verified |
| 3 | dashboard/page.tsx | Optimistic update for alert dismissal |
| 4 | trpc.ts, trpc/server.ts | Server-side tRPC caller |
| 5 | DashboardClient.tsx, dashboard/page.tsx | Convert dashboard to RSC |
| 6 | AggregatedView.tsx, reports/portfolio/page.tsx | Lazy load charts |
| 7 | - | Test and push |
