# Performance Optimization Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve navigation speed, reduce initial load time, and optimize data fetching across the dashboard.

**Architecture:** Add prefetching for common navigation paths, lazy load the ChatPanel component, add Vercel Speed Insights for monitoring, and consolidate dashboard queries into a single server-side fetch to eliminate client-side waterfalls.

**Tech Stack:** Next.js dynamic imports, tRPC, Vercel Speed Insights, React Query prefetching

---

## Task 1: Add Vercel Speed Insights

**Files:**
- Modify: `src/app/layout.tsx:1-10,69`

**Step 1: Add SpeedInsights import**

At the top of `src/app/layout.tsx`, add the import after the existing Vercel analytics import:

```typescript
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
```

**Step 2: Add SpeedInsights component**

In the body, add `<SpeedInsights />` after the `<Analytics />` component (around line 69):

```tsx
          <Toaster richColors position="top-right" />
          <Analytics />
          <SpeedInsights />
```

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "perf: add Vercel Speed Insights for Web Vitals monitoring"
```

---

## Task 2: Lazy Load ChatPanel

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx:1-8,24-25`

**Step 1: Add dynamic import**

Replace the static ChatPanel import with a dynamic import at the top of the file:

```typescript
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatButton } from "@/components/chat/ChatButton";
import dynamic from "next/dynamic";

const ChatPanel = dynamic(
  () => import("@/components/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })),
  { ssr: false }
);
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors, ChatPanel chunk is separate

**Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "perf: lazy load ChatPanel to reduce initial bundle"
```

---

## Task 3: Create Consolidated Dashboard Router

**Files:**
- Create: `src/server/routers/dashboard.ts`
- Modify: `src/server/routers/_app.ts:1-55,105-106`

**Step 1: Create the dashboard router file**

Create `src/server/routers/dashboard.ts`:

```typescript
import { router, protectedProcedure } from "../trpc";
import { properties, transactions, bankConnectionAlerts, onboardingProgress } from "../db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

export const dashboardRouter = router({
  getInitialData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.portfolio.ownerId;

    // Run all queries in parallel
    const [
      statsResult,
      alertsResult,
      onboardingResult,
      propertiesResult,
    ] = await Promise.all([
      // Stats query
      Promise.all([
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(properties)
          .where(eq(properties.userId, userId)),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(eq(transactions.userId, userId)),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.category, "uncategorized")
            )
          ),
      ]).then(([props, txns, uncategorized]) => ({
        propertyCount: props[0]?.count ?? 0,
        transactionCount: txns[0]?.count ?? 0,
        uncategorizedCount: uncategorized[0]?.count ?? 0,
      })),

      // Alerts query
      ctx.db
        .select()
        .from(bankConnectionAlerts)
        .where(
          and(
            eq(bankConnectionAlerts.userId, userId),
            isNull(bankConnectionAlerts.dismissedAt)
          )
        ),

      // Onboarding query
      ctx.db
        .select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId))
        .then((rows) => rows[0] ?? null),

      // Properties query
      ctx.db
        .select()
        .from(properties)
        .where(eq(properties.userId, userId)),
    ]);

    return {
      stats: statsResult,
      alerts: alertsResult,
      onboarding: onboardingResult,
      properties: propertiesResult,
    };
  }),
});
```

**Step 2: Register the router in _app.ts**

Add import at the top of `src/server/routers/_app.ts` (after line 52):

```typescript
import { dashboardRouter } from "./dashboard";
```

Add to the router object (after line 105, before the closing `}`):

```typescript
  settlement: settlementRouter,
  dashboard: dashboardRouter,
});
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/server/routers/dashboard.ts src/server/routers/_app.ts
git commit -m "feat: add consolidated dashboard.getInitialData query"
```

---

## Task 4: Update Dashboard Page to Use Consolidated Query

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx:20-50,93`

**Step 1: Update the server page to fetch consolidated data**

Replace `src/app/(dashboard)/dashboard/page.tsx` with:

```typescript
import { getServerTRPC } from "@/lib/trpc/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { AdvisorDashboard } from "@/components/dashboard/AdvisorDashboard";

export default async function DashboardPage() {
  let initialData = null;
  let advisorPortfolios: { ownerId: string; ownerName: string; role: string }[] = [];
  let isAdvisorOnly = false;

  try {
    const trpc = await getServerTRPC();
    const [dashboardData, portfolios] = await Promise.all([
      trpc.dashboard.getInitialData().catch(() => null),
      trpc.team.getAccessiblePortfolios().catch(() => []),
    ]);
    initialData = dashboardData;
    advisorPortfolios = portfolios.filter(
      (p) => p.role === "accountant" || p.role === "advisor"
    );
    // Show advisor dashboard if user has NO own properties and IS an advisor
    isAdvisorOnly = !dashboardData?.stats && advisorPortfolios.length > 0;
  } catch {
    // User might not be authenticated yet, client will handle
  }

  if (isAdvisorOnly) {
    return <AdvisorDashboard portfolios={advisorPortfolios} />;
  }

  return <DashboardClient initialData={initialData} />;
}
```

**Step 2: Update DashboardClient to accept consolidated initialData**

Update the interface and props in `src/components/dashboard/DashboardClient.tsx`:

Replace lines 20-28:

```typescript
interface DashboardStats {
  propertyCount: number;
  transactionCount: number;
  uncategorizedCount: number;
}

interface DashboardInitialData {
  stats: DashboardStats;
  alerts: Array<{
    id: string;
    alertType: string;
    connectionId: string;
    message: string;
    createdAt: Date;
    dismissedAt: Date | null;
  }>;
  onboarding: {
    showWizard: boolean;
    showChecklist: boolean;
    progress: Record<string, boolean>;
  } | null;
  properties: Array<{
    id: string;
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    purchasePrice: string;
    purchaseDate: string;
    entityName: string;
  }>;
}

interface DashboardClientProps {
  initialData: DashboardInitialData | null;
}
```

**Step 3: Update the component to use initialData**

Replace lines 30-50 with:

```typescript
export function DashboardClient({ initialData }: DashboardClientProps) {
  const [wizardClosed, setWizardClosed] = useState(false);
  const utils = trpc.useUtils();
  useReferralTracking();

  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery(undefined, {
    initialData: initialData?.stats,
    staleTime: 60_000,
  });

  const { data: alerts } = trpc.banking.listAlerts.useQuery(undefined, {
    initialData: initialData?.alerts,
    staleTime: 10_000,
  });

  const { data: onboarding } = trpc.onboarding.getProgress.useQuery(undefined, {
    initialData: initialData?.onboarding ?? undefined,
    staleTime: 5 * 60_000,
  });

  const { data: properties } = trpc.property.list.useQuery(undefined, {
    initialData: initialData?.properties,
    staleTime: 5 * 60_000,
  });
```

**Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 5: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "perf: use consolidated dashboard query for faster initial load"
```

---

## Task 5: Add Hover Prefetch to Property Cards

**Files:**
- Modify: `src/components/properties/PropertyCard.tsx:1-16,28-36`

**Step 1: Add trpc import and prefetch handler**

Add the trpc import and modify the component:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Calendar, DollarSign, MoreVertical, FileText } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { Property } from "@/server/db/schema";
import { trpc } from "@/lib/trpc/client";
```

**Step 2: Add prefetch handler in the component**

After line 29 (inside the component, before the formattedPrice line), add:

```typescript
export function PropertyCard({ property, onEdit, onDelete }: PropertyCardProps) {
  const utils = trpc.useUtils();

  const handlePrefetch = () => {
    utils.property.getById.prefetch({ id: property.id });
  };

  const formattedPrice = new Intl.NumberFormat("en-AU", {
```

**Step 3: Wrap the Card with Link and add onMouseEnter**

Replace the Card component (lines 36-92) to wrap it in a Link with prefetch:

```typescript
  return (
    <Link
      href={`/properties/${property.id}`}
      onMouseEnter={handlePrefetch}
      className="block"
    >
      <Card className="hover:border-primary transition-colors">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{property.address}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {property.suburb}, {property.state} {property.postcode}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit?.(property.id); }}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/properties/${property.id}/documents`}>
                  <FileText className="w-4 h-4 mr-2" />
                  Documents
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.preventDefault(); onDelete?.(property.id); }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>{formattedPrice}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(new Date(property.purchaseDate), "MMM yyyy")}</span>
            </div>
          </div>
          <div className="mt-3">
            <Badge variant="secondary">{property.entityName}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
```

**Step 4: Update properties page to not use router.push**

In `src/app/(dashboard)/properties/page.tsx`, remove the router and handleEdit since the card is now a link:

Remove line 8 and lines 23-25:
```typescript
// Remove: import { useRouter } from "next/navigation";
// Remove: const router = useRouter();
// Remove: const handleEdit = (id: string) => { router.push(`/properties/${id}/edit`); };
```

Update line 74 to not pass onEdit:
```typescript
            <PropertyCard
              key={property.id}
              property={property}
              onDelete={handleDelete}
            />
```

**Step 5: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 6: Commit**

```bash
git add src/components/properties/PropertyCard.tsx src/app/(dashboard)/properties/page.tsx
git commit -m "perf: add hover prefetch to property cards for faster navigation"
```

---

## Task 6: Add Background Prefetch on Dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx:32-34`

**Step 1: Add useEffect for background prefetch**

After the `useReferralTracking()` call and before the queries, add:

```typescript
  useReferralTracking();

  // Background prefetch common navigation targets
  useEffect(() => {
    // Prefetch after initial render to not block main thread
    const timer = setTimeout(() => {
      utils.property.list.prefetch();
      utils.transaction.list.prefetch({ page: 1, pageSize: 50 });
    }, 1000);
    return () => clearTimeout(timer);
  }, [utils]);

  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery(undefined, {
```

**Step 2: Add useEffect import**

Update the import at the top:

```typescript
import { useState, useEffect } from "react";
```

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "perf: add background prefetch for properties and transactions"
```

---

## Task 7: Optimize Sidebar pendingCount Query

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:4,77-81`

**Step 1: Add usePathname check for conditional fetching**

The sidebar already imports `usePathname`. Update the query to only fetch on relevant pages:

Replace lines 77-81:

```typescript
export function Sidebar() {
  const pathname = usePathname();
  const shouldFetchPendingCount = pathname === "/dashboard" || pathname === "/transactions/review" || pathname.startsWith("/transactions");

  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery(undefined, {
    staleTime: 60_000, // Refresh every 60 seconds (increased from 30)
    refetchOnWindowFocus: false,
    enabled: shouldFetchPendingCount,
  });
  const { data: activeEntity } = trpc.entity.getActive.useQuery(undefined, {
    staleTime: Infinity,
  });
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "perf: only fetch pendingCount on relevant pages"
```

---

## Task 8: Final Verification and Bundle Analysis

**Files:**
- None (verification only)

**Step 1: Run full build**

Run: `npm run build`
Expected: Build completes without errors, check for any warnings

**Step 2: Run bundle analyzer**

Run: `ANALYZE=true npm run build`
Expected: Browser opens with bundle visualization. Verify:
- ChatPanel is in a separate chunk
- recharts chunks are separate
- No unexpected large dependencies in main bundle

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Run linting**

Run: `npm run lint`
Expected: No errors

**Step 5: Create final commit if any fixes needed**

If any fixes were required, commit them:
```bash
git add -A
git commit -m "fix: address build issues from performance optimization"
```

---

## Summary

| Task | Description | Impact |
|------|-------------|--------|
| 1 | Add Speed Insights | Web Vitals monitoring |
| 2 | Lazy load ChatPanel | ~50KB off initial bundle |
| 3 | Consolidated dashboard query | Server-side parallel fetch |
| 4 | Use consolidated data in client | Eliminates 4 client round-trips |
| 5 | Hover prefetch on property cards | Instant navigation feel |
| 6 | Background prefetch on dashboard | Pre-warm cache for common paths |
| 7 | Conditional pendingCount fetch | Reduce unnecessary queries |
| 8 | Final verification | Ensure no regressions |

**Expected outcomes:**
- Dashboard loads with all data pre-fetched (no loading spinners)
- Navigation to properties/transactions feels instant
- Initial JS bundle reduced by ~50KB (ChatPanel)
- Web Vitals tracked in Vercel dashboard
