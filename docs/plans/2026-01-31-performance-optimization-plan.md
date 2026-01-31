# Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve page load performance across all pages by fixing caching, reducing bundle size, and optimizing data loading.

**Architecture:** Remove global `force-dynamic`, apply ISR to public pages, dynamically import heavy libs (recharts, xlsx, jspdf), consolidate dashboard queries, optimize sidebar.

**Tech Stack:** Next.js 16, tRPC, React Query, Drizzle ORM

---

## Phase 1: Caching Strategy (Highest Impact)

### Task 1: Remove force-dynamic from Root Layout

**Files:**
- Modify: `src/app/layout.tsx:52`

**Step 1: Remove the force-dynamic export**

Delete line 52:
```tsx
// DELETE THIS LINE:
export const dynamic = "force-dynamic";
```

**Step 2: Verify dashboard layout still has force-dynamic**

Check `src/app/(dashboard)/layout.tsx:8` still contains:
```tsx
export const dynamic = "force-dynamic";
```

**Step 3: Run build to verify no errors**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "perf: remove force-dynamic from root layout

Allows public pages (landing, blog, changelog) to be statically
generated and edge-cached instead of server-rendered on every request."
```

---

### Task 2: Add ISR to Blog Post Pages

**Files:**
- Modify: `src/app/blog/[slug]/page.tsx:12`

**Step 1: Replace force-dynamic with revalidate**

Change line 12 from:
```tsx
export const dynamic = "force-dynamic";
```
To:
```tsx
export const revalidate = 86400; // Revalidate daily
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Blog routes show as ISR in build output

**Step 3: Commit**

```bash
git add src/app/blog/[slug]/page.tsx
git commit -m "perf: add ISR to blog posts (daily revalidation)"
```

---

### Task 3: Add ISR to Changelog Page

**Files:**
- Modify: `src/app/changelog/page.tsx:7`

**Step 1: Replace force-dynamic with revalidate**

Change line 7 from:
```tsx
export const dynamic = "force-dynamic";
```
To:
```tsx
export const revalidate = 3600; // Revalidate hourly
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Changelog route shows as ISR in build output

**Step 3: Commit**

```bash
git add src/app/changelog/page.tsx
git commit -m "perf: add ISR to changelog (hourly revalidation)"
```

---

### Task 4: Test Public Pages Caching

**Step 1: Start production build locally**

Run: `npm run build && npm run start`

**Step 2: Test landing page caching**

Run: `curl -I http://localhost:3000`
Expected: Response includes cache headers (x-nextjs-cache or similar)

**Step 3: Test blog page caching**

Run: `curl -I http://localhost:3000/blog`
Expected: Response includes cache headers

**Step 4: Test authenticated routes still work**

Open browser: `http://localhost:3000/dashboard`
Expected: Redirects to sign-in (auth working correctly)

**Step 5: Commit verification notes**

No commit needed - verification complete.

---

## Phase 2: Bundle Size Reduction

### Task 5: Install Bundle Analyzer

**Files:**
- Modify: `package.json`

**Step 1: Install @next/bundle-analyzer**

Run: `npm install -D @next/bundle-analyzer`

**Step 2: Create next.config analyzer wrapper**

Create `next.config.ts` changes (if using next.config.js, adapt):
```typescript
// At top of next.config.ts:
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Wrap export:
export default withBundleAnalyzer(nextConfig);
```

**Step 3: Run baseline analysis**

Run: `ANALYZE=true npm run build`
Expected: Browser opens with bundle visualization. Screenshot/note the sizes.

**Step 4: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: add bundle analyzer for performance measurement"
```

---

### Task 6: Create Chart Skeleton Component

**Files:**
- Create: `src/components/ui/chart-skeleton.tsx`

**Step 1: Create the skeleton component**

```tsx
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="w-full bg-muted animate-pulse rounded-lg"
      style={{ height }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/chart-skeleton.tsx
git commit -m "feat: add ChartSkeleton component for lazy loading"
```

---

### Task 7: Dynamic Import for Recharts in EquityDonutChart

**Files:**
- Modify: `src/components/portfolio/EquityDonutChart.tsx`

**Step 1: Read current file to understand structure**

Check current imports at top of file.

**Step 2: Replace static import with dynamic**

At top of file, change:
```tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
```
To:
```tsx
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

const RechartsComponents = dynamic(
  () => import("recharts").then((mod) => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    PieChart: mod.PieChart,
    Pie: mod.Pie,
    Cell: mod.Cell,
    ResponsiveContainer: mod.ResponsiveContainer,
    Tooltip: mod.Tooltip,
  })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={250} />
  }
);
```

Note: This pattern may need adjustment based on actual component structure. The simpler approach is to wrap the entire chart component.

**Step 3: Alternative - Create wrapper component**

If the above is complex, create `src/components/charts/LazyEquityDonutChart.tsx`:
```tsx
"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const LazyEquityDonutChart = dynamic(
  () => import("@/components/portfolio/EquityDonutChart").then(mod => mod.EquityDonutChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={250} />
  }
);
```

Then update imports where EquityDonutChart is used.

**Step 4: Verify chart still renders**

Run: `npm run dev`
Navigate to portfolio page, verify chart loads after skeleton.

**Step 5: Commit**

```bash
git add src/components/portfolio/EquityDonutChart.tsx src/components/charts/
git commit -m "perf: lazy load EquityDonutChart to reduce initial bundle"
```

---

### Task 8: Dynamic Import for CashFlowBarChart

**Files:**
- Create: `src/components/charts/LazyCashFlowBarChart.tsx`
- Modify: Consumer files

**Step 1: Create lazy wrapper**

```tsx
"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const LazyCashFlowBarChart = dynamic(
  () => import("@/components/portfolio/CashFlowBarChart").then(mod => mod.CashFlowBarChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={300} />
  }
);
```

**Step 2: Update imports in consumer files**

Find files importing CashFlowBarChart and update to use lazy version.

**Step 3: Test rendering**

Run: `npm run dev`
Verify chart loads correctly.

**Step 4: Commit**

```bash
git add src/components/charts/LazyCashFlowBarChart.tsx
git commit -m "perf: lazy load CashFlowBarChart"
```

---

### Task 9: Dynamic Import for ForecastChart

**Files:**
- Create: `src/components/charts/LazyForecastChart.tsx`

**Step 1: Create lazy wrapper**

```tsx
"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const LazyForecastChart = dynamic(
  () => import("@/components/forecast/ForecastChart").then(mod => mod.ForecastChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={400} />
  }
);
```

**Step 2: Update forecast page imports**

**Step 3: Test and commit**

```bash
git add src/components/charts/LazyForecastChart.tsx
git commit -m "perf: lazy load ForecastChart"
```

---

### Task 10: Lazy Load ChatPanel

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Change ChatPanel import to dynamic**

Change:
```tsx
import { ChatPanel } from "@/components/chat/ChatPanel";
```
To:
```tsx
import dynamic from "next/dynamic";

const ChatPanel = dynamic(
  () => import("@/components/chat/ChatPanel").then(mod => mod.ChatPanel),
  { ssr: false }
);
```

**Step 2: Verify chat still works**

Run: `npm run dev`
Navigate to dashboard, click chat button, verify panel opens.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "perf: lazy load ChatPanel (only loads on open)"
```

---

### Task 11: Move xlsx/jspdf to Server-Side API Route

**Files:**
- Create: `src/app/api/export/tax-report/route.ts`
- Create: `src/app/api/export/transactions/route.ts`
- Modify: `src/lib/export-utils.ts` (split into client/server)

**Step 1: Create tax report API route**

```typescript
// src/app/api/export/tax-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import jsPDF from "jspdf";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();

  // Generate PDF server-side (move logic from export-utils.ts)
  const doc = new jsPDF();
  // ... PDF generation logic ...

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tax-report-${data.financialYear}.pdf"`,
    },
  });
}
```

**Step 2: Create transactions export API route**

```typescript
// src/app/api/export/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactions, financialYear } = await req.json();

  // Generate Excel server-side
  const data = transactions.map((t: any) => ({
    Date: t.date,
    Property: t.property?.address || "Unassigned",
    Description: t.description,
    Amount: Number(t.amount),
    Category: t.category,
    Deductible: t.isDeductible ? "Yes" : "No",
    Verified: t.isVerified ? "Yes" : "No",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, financialYear);

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return new NextResponse(excelBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="transactions-${financialYear}.xlsx"`,
    },
  });
}
```

**Step 3: Update client export utils**

```typescript
// src/lib/export-utils.ts (client-side only now)
export async function downloadTaxReportPDF(data: TaxReportData) {
  const response = await fetch("/api/export/tax-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const blob = await response.blob();
  downloadBlob(blob, `tax-report-${data.financialYear}.pdf`);
}

export async function downloadTransactionsExcel(
  transactions: Transaction[],
  financialYear: string
) {
  const response = await fetch("/api/export/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions, financialYear }),
  });

  const blob = await response.blob();
  downloadBlob(blob, `transactions-${financialYear}.xlsx`);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Step 4: Remove jspdf and xlsx from client imports**

Update any components using these to call the new API functions instead.

**Step 5: Test export functionality**

Run: `npm run dev`
Navigate to export page, test PDF and Excel downloads.

**Step 6: Run bundle analysis to verify improvement**

Run: `ANALYZE=true npm run build`
Expected: xlsx and jspdf no longer in client bundle.

**Step 7: Commit**

```bash
git add src/app/api/export/ src/lib/export-utils.ts
git commit -m "perf: move xlsx/jspdf generation to server-side API routes

Removes ~800KB from client bundle by generating Excel and PDF
files on the server instead of in the browser."
```

---

## Phase 3: Data Loading Optimization

### Task 12: Optimize Sidebar Queries

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add staleTime to entity query**

Change line 79:
```tsx
const { data: activeEntity } = trpc.entity.getActive.useQuery();
```
To:
```tsx
const { data: activeEntity } = trpc.entity.getActive.useQuery(undefined, {
  staleTime: Infinity, // Entity rarely changes, invalidate on switch
});
```

**Step 2: Add staleTime to pending count query**

Change line 78:
```tsx
const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery();
```
To:
```tsx
const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery(undefined, {
  staleTime: 30_000, // Refresh every 30 seconds
  refetchOnWindowFocus: false,
});
```

**Step 3: Verify sidebar still works**

Run: `npm run dev`
Navigate between pages, verify badge count and entity switcher work.

**Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "perf: optimize sidebar queries with staleTime

Reduces unnecessary refetches on every navigation."
```

---

### Task 13: Create Consolidated Dashboard Query

**Files:**
- Create: `src/server/routers/dashboard.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create dashboard router**

```typescript
// src/server/routers/dashboard.ts
import { router, protectedProcedure } from "../trpc";
import { properties, transactions, connectionAlerts, onboardingProgress } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export const dashboardRouter = router({
  getInitialData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.portfolio.ownerId;

    // Run all queries in parallel
    const [
      propertiesResult,
      transactionsResult,
      uncategorizedResult,
      alerts,
      onboarding,
      propertyList,
    ] = await Promise.all([
      // Stats: property count
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(properties)
        .where(eq(properties.userId, userId)),

      // Stats: transaction count
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(eq(transactions.userId, userId)),

      // Stats: uncategorized count
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.category, "uncategorized")
          )
        ),

      // Alerts
      ctx.db
        .select()
        .from(connectionAlerts)
        .where(eq(connectionAlerts.userId, userId))
        .orderBy(desc(connectionAlerts.createdAt)),

      // Onboarding progress (simplified - adjust based on actual schema)
      ctx.db
        .select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId))
        .limit(1),

      // Property list for widgets
      ctx.db
        .select()
        .from(properties)
        .where(eq(properties.userId, userId)),
    ]);

    return {
      stats: {
        propertyCount: propertiesResult[0]?.count ?? 0,
        transactionCount: transactionsResult[0]?.count ?? 0,
        uncategorizedCount: uncategorizedResult[0]?.count ?? 0,
      },
      alerts,
      onboarding: onboarding[0] ?? null,
      properties: propertyList,
    };
  }),
});
```

**Step 2: Add to app router**

In `src/server/routers/_app.ts`, add:
```typescript
import { dashboardRouter } from "./dashboard";

export const appRouter = router({
  // ... existing routers
  dashboard: dashboardRouter,
});
```

**Step 3: Commit**

```bash
git add src/server/routers/dashboard.ts src/server/routers/_app.ts
git commit -m "feat: add consolidated dashboard.getInitialData query

Combines stats, alerts, onboarding, and properties into single round-trip."
```

---

### Task 14: Update Dashboard Page to Use Consolidated Query

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Update server component**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
import { getServerTRPC } from "@/lib/trpc/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { AdvisorDashboard } from "@/components/dashboard/AdvisorDashboard";

export default async function DashboardPage() {
  let initialData = null;
  let advisorPortfolios: { ownerId: string; ownerName: string; role: string }[] = [];
  let isAdvisorOnly = false;

  try {
    const trpc = await getServerTRPC();
    const [data, portfolios] = await Promise.all([
      trpc.dashboard.getInitialData().catch(() => null),
      trpc.team.getAccessiblePortfolios().catch(() => []),
    ]);
    initialData = data;
    advisorPortfolios = portfolios.filter(
      (p) => p.role === "accountant" || p.role === "advisor"
    );
    isAdvisorOnly = !data?.stats && advisorPortfolios.length > 0;
  } catch {
    // User might not be authenticated yet
  }

  if (isAdvisorOnly) {
    return <AdvisorDashboard portfolios={advisorPortfolios} />;
  }

  return <DashboardClient initialData={initialData} />;
}
```

**Step 2: Update client component to use consolidated data**

Update `DashboardClient` props and remove individual queries that are now in initialData.

**Step 3: Test dashboard loads correctly**

Run: `npm run dev`
Navigate to dashboard, verify all widgets render with data.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "perf: use consolidated dashboard query

Reduces dashboard load from 4+ API calls to 1."
```

---

## Phase 4: Verification & Measurement

### Task 15: Run Final Bundle Analysis

**Step 1: Run analyzer**

Run: `ANALYZE=true npm run build`

**Step 2: Document improvements**

Note bundle sizes and compare to baseline from Task 5.

**Step 3: No commit - measurement only**

---

### Task 16: Run Lighthouse Audit

**Step 1: Build and start production**

Run: `npm run build && npm run start`

**Step 2: Run Lighthouse on landing page**

Open Chrome DevTools > Lighthouse > Generate report for `/`

**Step 3: Run Lighthouse on dashboard**

Sign in, run Lighthouse on `/dashboard`

**Step 4: Document scores**

Compare to success criteria:
- [ ] Lighthouse Performance score > 80 on mobile for `/dashboard`
- [ ] Initial JS bundle < 500KB
- [ ] Time to Interactive < 3s on 3G throttled

**Step 5: Update design doc with results**

Add measurement results to `docs/plans/2026-01-31-performance-optimization-design.md`

**Step 6: Final commit**

```bash
git add docs/plans/
git commit -m "docs: add performance measurement results"
```

---

## Summary

| Task | Description | Risk |
|------|-------------|------|
| 1-4 | Caching strategy | Low |
| 5-11 | Bundle size reduction | Medium |
| 12-14 | Data loading optimization | Medium |
| 15-16 | Verification | None |

**Total tasks:** 16
**Estimated commits:** 12

---

Plan complete and saved to `docs/plans/2026-01-31-performance-optimization-plan.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
