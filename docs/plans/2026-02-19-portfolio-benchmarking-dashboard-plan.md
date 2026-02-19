# Portfolio Benchmarking Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sortable portfolio benchmarking table page at `/analytics/benchmarking` with summary gauges, reusing the existing `getPortfolioScorecard` endpoint.

**Architecture:** Pure frontend feature. New page component queries `performanceBenchmarking.getPortfolioScorecard` (already tested). Client-side sorting via `useState`. Summary gauge cards at top, sortable ranking table below. No new backend work.

**Tech Stack:** React 19, tRPC v11 (client), Tailwind v4, Vitest

**Design doc:** `docs/plans/2026-02-19-portfolio-benchmarking-dashboard-design.md`

**Beads task:** property-tracker-ui7

---

## Tech Notes

**Existing endpoint:** `performanceBenchmarking.getPortfolioScorecard` returns `PortfolioScorecardSummary` with `properties: PropertyScorecardEntry[]`, averages, and best/worst performers. Types at `src/types/performance-benchmarking.ts`.

**Format utilities:** `formatCurrency`, `formatPercent`, `cn` from `@/lib/utils`. `formatCurrency` returns `"$1,234"`, `formatPercent` returns `"5.5%"`.

**Badge variants:** `"default"`, `"secondary"`, `"destructive"`, `"outline"`, `"warning"` from `@/components/ui/badge`.

**Feature flags:** Add key to `featureFlags` object in `src/config/feature-flags.ts`, add route to `routeToFlag` map.

**Analytics nav:** No analytics layout exists yet. Scorecard page is at `src/app/(dashboard)/analytics/scorecard/page.tsx`. Sidebar at `src/components/layout/Sidebar.tsx` handles nav links gated by feature flags.

**Score labels:** `"Excellent"` | `"Good"` | `"Average"` | `"Below Average"` | `"Poor"` — from `PropertyScorecardEntry.scoreLabel`.

---

### Task 1: Feature flag

**Files:**
- Modify: `src/config/feature-flags.ts`

**Step 1: Add feature flag**

In `src/config/feature-flags.ts`, add `portfolioBenchmarking: true` near the existing `performanceBenchmark` flag:

```typescript
  performanceBenchmark: false,
  portfolioBenchmarking: true,
```

And add the route mapping in `routeToFlag`:

```typescript
  "/analytics/benchmarking": "portfolioBenchmarking",
```

**Step 2: Commit**

```bash
git add src/config/feature-flags.ts
git commit -m "feat: add portfolioBenchmarking feature flag"
```

---

### Task 2: Sort utility + tests

**Files:**
- Create: `src/lib/__tests__/benchmark-sort.test.ts`
- Create: `src/lib/benchmark-sort.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/benchmark-sort.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sortProperties } from "../benchmark-sort";
import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";

const makeEntry = (
  overrides: Partial<PropertyScorecardEntry>
): PropertyScorecardEntry => ({
  propertyId: "p1",
  address: "123 Main St",
  suburb: "Richmond",
  state: "VIC",
  purchasePrice: 500000,
  currentValue: 600000,
  grossYield: 5.0,
  netYield: 3.5,
  annualCashFlow: 10000,
  annualRent: 30000,
  annualExpenses: 20000,
  performanceScore: 70,
  scoreLabel: "Good",
  yieldPercentile: 60,
  expensePercentile: 50,
  isUnderperforming: false,
  capRate: 4.5,
  cashOnCash: 8.0,
  annualTaxDeductions: 5000,
  capitalGrowthPercent: 20,
  equity: 200000,
  ...overrides,
});

describe("sortProperties", () => {
  const properties = [
    makeEntry({ propertyId: "a", performanceScore: 70, grossYield: 5.0, netYield: 3.5, annualRent: 30000, annualExpenses: 20000 }),
    makeEntry({ propertyId: "b", performanceScore: 90, grossYield: 3.0, netYield: 1.5, annualRent: 20000, annualExpenses: 10000 }),
    makeEntry({ propertyId: "c", performanceScore: 50, grossYield: 7.0, netYield: 5.5, annualRent: 40000, annualExpenses: 30000 }),
  ];

  it("sorts by performanceScore descending by default", () => {
    const sorted = sortProperties(properties, "score", "desc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("sorts by grossYield ascending", () => {
    const sorted = sortProperties(properties, "grossYield", "asc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("sorts by expenseRatio descending (higher ratio = more expenses)", () => {
    // expense ratios: a=66.7%, b=50%, c=75%
    const sorted = sortProperties(properties, "expenseRatio", "desc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["c", "a", "b"]);
  });

  it("sorts by netYield descending", () => {
    const sorted = sortProperties(properties, "netYield", "desc");
    expect(sorted.map((p) => p.propertyId)).toEqual(["c", "a", "b"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/benchmark-sort.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

Create `src/lib/benchmark-sort.ts`:

```typescript
import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";

export type SortColumn = "score" | "grossYield" | "netYield" | "expenseRatio";
export type SortDirection = "asc" | "desc";

function getExpenseRatio(p: PropertyScorecardEntry): number {
  return p.annualRent > 0 ? (p.annualExpenses / p.annualRent) * 100 : 0;
}

function getValue(p: PropertyScorecardEntry, column: SortColumn): number {
  switch (column) {
    case "score":
      return p.performanceScore;
    case "grossYield":
      return p.grossYield;
    case "netYield":
      return p.netYield;
    case "expenseRatio":
      return getExpenseRatio(p);
  }
}

export function sortProperties(
  properties: PropertyScorecardEntry[],
  column: SortColumn,
  direction: SortDirection
): PropertyScorecardEntry[] {
  return [...properties].sort((a, b) => {
    const aVal = getValue(a, column);
    const bVal = getValue(b, column);
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });
}

export { getExpenseRatio };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/benchmark-sort.test.ts`
Expected: All 4 tests pass.

**Step 5: Commit**

```bash
git add src/lib/benchmark-sort.ts src/lib/__tests__/benchmark-sort.test.ts
git commit -m "feat: add sortProperties utility for benchmarking table"
```

---

### Task 3: Summary gauges component

**Files:**
- Create: `src/components/analytics/BenchmarkSummaryGauges.tsx`

**Step 1: Read existing patterns**

Read `src/app/(dashboard)/analytics/scorecard/page.tsx` for the summary stats grid pattern. Read `src/components/ui/badge.tsx` for badge variants.

**Step 2: Create the component**

Create `src/components/analytics/BenchmarkSummaryGauges.tsx`:

```tsx
"use client";

import { TrendingUp, Trophy, AlertTriangle, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PortfolioScorecardSummary } from "@/types/performance-benchmarking";

interface BenchmarkSummaryGaugesProps {
  data: PortfolioScorecardSummary;
}

function getScoreBadgeVariant(
  label: string
): "default" | "secondary" | "destructive" | "warning" {
  switch (label) {
    case "Excellent":
      return "default";
    case "Good":
      return "secondary";
    case "Below Average":
      return "warning";
    case "Poor":
      return "destructive";
    default:
      return "secondary";
  }
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  if (score >= 20) return "Below Average";
  return "Poor";
}

export function BenchmarkSummaryGauges({ data }: BenchmarkSummaryGaugesProps) {
  const scoreLabel = getScoreLabel(data.averageScore);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Score</CardTitle>
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {Math.round(data.averageScore)}
            </span>
            <Badge variant={getScoreBadgeVariant(scoreLabel)}>
              {scoreLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Average across {data.properties.length} properties
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Avg Gross Yield
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPercent(data.averageGrossYield)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Portfolio average yield
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Annual Cash Flow
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.totalAnnualCashFlow)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Net income minus expenses
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
          <Trophy className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {data.bestPerformer ? (
            <>
              <div className="text-lg font-bold truncate">
                {data.bestPerformer.address}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Score: {data.bestPerformer.score}
                {data.worstPerformer && (
                  <span>
                    {" "}
                    · Weakest: {data.worstPerformer.address} (
                    {data.worstPerformer.score})
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/analytics/BenchmarkSummaryGauges.tsx
git commit -m "feat: add BenchmarkSummaryGauges component"
```

---

### Task 4: Ranking table component

**Files:**
- Create: `src/components/analytics/BenchmarkRankingTable.tsx`

**Step 1: Read existing patterns**

Read `src/components/analytics/ScorecardComparison.tsx` for table styling patterns, color-coding logic, and badge usage.

**Step 2: Create the component**

Create `src/components/analytics/BenchmarkRankingTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPercent, cn } from "@/lib/utils";
import {
  sortProperties,
  getExpenseRatio,
  type SortColumn,
  type SortDirection,
} from "@/lib/benchmark-sort";
import type { PropertyScorecardEntry } from "@/types/performance-benchmarking";
import Link from "next/link";

interface BenchmarkRankingTableProps {
  properties: PropertyScorecardEntry[];
  averageScore: number;
  averageGrossYield: number;
  averageNetYield: number;
}

function getScoreBadgeVariant(
  label: string
): "default" | "secondary" | "destructive" | "warning" {
  switch (label) {
    case "Excellent":
      return "default";
    case "Good":
      return "secondary";
    case "Below Average":
      return "warning";
    case "Poor":
      return "destructive";
    default:
      return "secondary";
  }
}

function getCellColor(
  value: number,
  average: number,
  invert = false
): string {
  const threshold = average * 0.05;
  const diff = value - average;
  const isAbove = diff > threshold;
  const isBelow = diff < -threshold;

  if (invert) {
    // Lower is better (expense ratio)
    if (isBelow) return "text-green-600 dark:text-green-400";
    if (isAbove) return "text-red-600 dark:text-red-400";
  } else {
    if (isAbove) return "text-green-600 dark:text-green-400";
    if (isBelow) return "text-red-600 dark:text-red-400";
  }
  return "";
}

const COLUMNS: {
  key: SortColumn;
  label: string;
  invert?: boolean;
}[] = [
  { key: "score", label: "Score" },
  { key: "grossYield", label: "Gross Yield" },
  { key: "netYield", label: "Net Yield" },
  { key: "expenseRatio", label: "Expense Ratio", invert: true },
];

export function BenchmarkRankingTable({
  properties,
  averageScore,
  averageGrossYield,
  averageNetYield,
}: BenchmarkRankingTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sorted = sortProperties(properties, sortColumn, sortDirection);

  // Calculate average expense ratio for color coding
  const totalExpenses = properties.reduce((s, p) => s + p.annualExpenses, 0);
  const totalRent = properties.reduce((s, p) => s + p.annualRent, 0);
  const averageExpenseRatio = totalRent > 0 ? (totalExpenses / totalRent) * 100 : 0;

  const averages: Record<SortColumn, number> = {
    score: averageScore,
    grossYield: averageGrossYield,
    netYield: averageNetYield,
    expenseRatio: averageExpenseRatio,
  };

  function SortIcon({ column }: { column: SortColumn }) {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5" />
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">
              #
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Property
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-right font-medium text-muted-foreground"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon column={col.key} />
                </Button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((property, index) => {
            const expenseRatio = getExpenseRatio(property);

            return (
              <tr
                key={property.propertyId}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground font-medium">
                  {index + 1}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/properties/${property.propertyId}`}
                    prefetch={false}
                    className="hover:underline"
                  >
                    <div className="font-medium">{property.address}</div>
                    <div className="text-xs text-muted-foreground">
                      {property.suburb}, {property.state}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        getCellColor(property.performanceScore, averages.score)
                      )}
                    >
                      {Math.round(property.performanceScore)}
                    </span>
                    <Badge
                      variant={getScoreBadgeVariant(property.scoreLabel)}
                      className="text-[10px]"
                    >
                      {property.scoreLabel}
                    </Badge>
                  </div>
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-medium",
                    getCellColor(property.grossYield, averages.grossYield)
                  )}
                >
                  {formatPercent(property.grossYield)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-medium",
                    getCellColor(property.netYield, averages.netYield)
                  )}
                >
                  {formatPercent(property.netYield)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-medium",
                    getCellColor(expenseRatio, averages.expenseRatio, true)
                  )}
                >
                  {formatPercent(expenseRatio)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/analytics/BenchmarkRankingTable.tsx
git commit -m "feat: add BenchmarkRankingTable with sortable columns"
```

---

### Task 5: Benchmarking page

**Files:**
- Create: `src/app/(dashboard)/analytics/benchmarking/page.tsx`

**Step 1: Read existing patterns**

Read `src/app/(dashboard)/analytics/scorecard/page.tsx` for the page pattern (query, loading state, empty state, layout).

**Step 2: Create the page**

Create `src/app/(dashboard)/analytics/benchmarking/page.tsx`:

```tsx
"use client";

import { BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { BenchmarkSummaryGauges } from "@/components/analytics/BenchmarkSummaryGauges";
import { BenchmarkRankingTable } from "@/components/analytics/BenchmarkRankingTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-md border">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b last:border-0">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BenchmarkingPage() {
  const { data, isLoading } =
    trpc.performanceBenchmarking.getPortfolioScorecard.useQuery(undefined, {
      staleTime: 5 * 60_000,
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Portfolio Benchmarking
        </h2>
        <p className="text-muted-foreground">
          Compare property performance across your portfolio. Sort by any metric
          to find your best and worst performers.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !data || data.properties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Add properties and transactions to see portfolio benchmarks.
            </p>
            <Button asChild>
              <Link href="/properties/new">Add Property</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <BenchmarkSummaryGauges data={data} />
          <BenchmarkRankingTable
            properties={data.properties}
            averageScore={data.averageScore}
            averageGrossYield={data.averageGrossYield}
            averageNetYield={data.averageNetYield}
          />
        </>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/analytics/benchmarking/page.tsx"
git commit -m "feat: add portfolio benchmarking page"
```

---

### Task 6: Navigation link

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (or wherever analytics nav links are)

**Step 1: Read the sidebar**

Read `src/components/layout/Sidebar.tsx` to find how nav items are structured and where analytics links are defined. Look for the scorecard link pattern.

**Step 2: Add benchmarking link**

Add a "Benchmarking" nav item in the analytics section, alongside the existing "Scorecard" link. Use `BarChart3` icon from lucide-react. Gate visibility with `featureFlags.portfolioBenchmarking`.

The exact code depends on the sidebar structure — follow the pattern used by the scorecard link.

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add benchmarking link to analytics nav"
```

---

### Task 7: Final verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Fix any type errors in our files.

**Step 2: Run our tests**

Run: `npx vitest run src/lib/__tests__/benchmark-sort.test.ts`
Expected: All 4 tests pass.

**Step 3: Run lint**

Run: `npx next lint`
Fix any lint errors in our files.

**Step 4: Commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve type and lint errors in benchmarking feature"
```

---
