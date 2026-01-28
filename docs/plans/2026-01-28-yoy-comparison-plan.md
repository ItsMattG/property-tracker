# Key Expenses YoY Comparison — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated report page comparing expense categories across two financial years, with portfolio-wide totals and per-property breakdowns.

**Architecture:** Pure service functions compute category-level YoY changes from transaction data for two financial years. A thin tRPC router exposes the comparison. A React page renders the data as color-coded tables with collapsible per-property sections.

**Tech Stack:** TypeScript, Vitest, tRPC, Drizzle ORM, Next.js App Router, shadcn/ui (Table, Card, Collapsible, Select), Lucide icons.

---

### Task 1: YoY Comparison Service — Pure Functions (TDD)

**Files:**
- Create: `src/server/services/__tests__/yoy-comparison.test.ts`
- Create: `src/server/services/yoy-comparison.ts`

**Step 1: Write the failing tests**

Create `src/server/services/__tests__/yoy-comparison.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeChange,
  buildCategoryComparison,
  sortCategories,
  KEY_EXPENSES,
} from "../yoy-comparison";

describe("computeChange", () => {
  it("computes dollar and percent change", () => {
    const result = computeChange(1100, 1000);
    expect(result.change).toBe(100);
    expect(result.changePercent).toBe(10);
    expect(result.isSignificant).toBe(false); // exactly 10 is not > 10
  });

  it("flags significant changes over 10%", () => {
    const result = computeChange(1200, 1000);
    expect(result.change).toBe(200);
    expect(result.changePercent).toBe(20);
    expect(result.isSignificant).toBe(true);
  });

  it("returns null percent when comparison year is zero", () => {
    const result = computeChange(500, 0);
    expect(result.change).toBe(500);
    expect(result.changePercent).toBeNull();
    expect(result.isSignificant).toBe(false);
  });

  it("handles decreases", () => {
    const result = computeChange(800, 1000);
    expect(result.change).toBe(-200);
    expect(result.changePercent).toBe(-20);
    expect(result.isSignificant).toBe(true);
  });

  it("handles both years zero", () => {
    const result = computeChange(0, 0);
    expect(result.change).toBe(0);
    expect(result.changePercent).toBeNull();
    expect(result.isSignificant).toBe(false);
  });
});

describe("buildCategoryComparison", () => {
  it("builds comparison from two category total maps", () => {
    const current = new Map([["land_tax", 3000], ["insurance", 1500]]);
    const comparison = new Map([["land_tax", 2500], ["insurance", 1400]]);

    const result = buildCategoryComparison(current, comparison);
    expect(result).toHaveLength(2);

    const landTax = result.find((c) => c.category === "land_tax")!;
    expect(landTax.label).toBe("Land Tax");
    expect(landTax.atoCode).toBe("D9");
    expect(landTax.isKeyExpense).toBe(true);
    expect(landTax.currentYear).toBe(3000);
    expect(landTax.comparisonYear).toBe(2500);
    expect(landTax.change).toBe(500);
    expect(landTax.changePercent).toBe(20);
    expect(landTax.isSignificant).toBe(true);
  });

  it("includes categories only in one year", () => {
    const current = new Map([["cleaning", 200]]);
    const comparison = new Map([["gardening", 300]]);

    const result = buildCategoryComparison(current, comparison);
    expect(result).toHaveLength(2);

    const cleaning = result.find((c) => c.category === "cleaning")!;
    expect(cleaning.currentYear).toBe(200);
    expect(cleaning.comparisonYear).toBe(0);

    const gardening = result.find((c) => c.category === "gardening")!;
    expect(gardening.currentYear).toBe(0);
    expect(gardening.comparisonYear).toBe(300);
  });

  it("excludes categories with zero in both years", () => {
    const current = new Map<string, number>();
    const comparison = new Map<string, number>();

    const result = buildCategoryComparison(current, comparison);
    expect(result).toHaveLength(0);
  });
});

describe("sortCategories", () => {
  it("sorts key expenses first in defined order, then others alphabetically", () => {
    const items = [
      { category: "cleaning", isKeyExpense: false },
      { category: "insurance", isKeyExpense: true },
      { category: "advertising", isKeyExpense: false },
      { category: "land_tax", isKeyExpense: true },
      { category: "council_rates", isKeyExpense: true },
    ];

    const sorted = sortCategories(items);
    expect(sorted.map((s) => s.category)).toEqual([
      "council_rates",  // key expense D5
      "insurance",      // key expense D7
      "land_tax",       // key expense D9
      "advertising",    // other, alphabetical
      "cleaning",       // other, alphabetical
    ]);
  });
});

describe("KEY_EXPENSES", () => {
  it("contains the 6 expected categories", () => {
    expect(KEY_EXPENSES).toEqual([
      "land_tax",
      "council_rates",
      "water_charges",
      "repairs_and_maintenance",
      "insurance",
      "body_corporate",
    ]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/__tests__/yoy-comparison.test.ts`
Expected: FAIL — module `../yoy-comparison` not found.

**Step 3: Write the service implementation**

Create `src/server/services/yoy-comparison.ts`:

```typescript
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { transactions, properties } from "@/server/db/schema";
import { categoryMap, categories } from "@/lib/categories";
import { getFinancialYearRange } from "./reports";

// --- Constants ---

export const KEY_EXPENSES = [
  "land_tax",
  "council_rates",
  "water_charges",
  "repairs_and_maintenance",
  "insurance",
  "body_corporate",
] as const;

const KEY_EXPENSE_SET = new Set<string>(KEY_EXPENSES);

// Key expenses sort by their ATO reference order (D2, D5, D7, D9, D13, D17)
const KEY_EXPENSE_ORDER = new Map(
  KEY_EXPENSES.map((k) => [k, categoryMap.get(k)?.atoReference ?? ""])
);

// --- Types ---

export interface YoYCategoryComparison {
  category: string;
  label: string;
  atoCode: string;
  isKeyExpense: boolean;
  currentYear: number;
  comparisonYear: number;
  change: number;
  changePercent: number | null;
  isSignificant: boolean;
}

export interface YoYPropertyBreakdown {
  propertyId: string;
  address: string;
  categories: YoYCategoryComparison[];
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}

export interface YoYComparisonResult {
  currentYear: number;
  comparisonYear: number;
  currentYearLabel: string;
  comparisonYearLabel: string;
  portfolio: YoYCategoryComparison[];
  properties: YoYPropertyBreakdown[];
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}

// --- Pure functions (exported for testing) ---

export function computeChange(
  currentYear: number,
  comparisonYear: number,
): { change: number; changePercent: number | null; isSignificant: boolean } {
  const change = currentYear - comparisonYear;
  if (comparisonYear === 0) {
    return { change, changePercent: null, isSignificant: false };
  }
  const changePercent = Math.round((change / comparisonYear) * 100);
  return {
    change,
    changePercent,
    isSignificant: Math.abs(changePercent) > 10,
  };
}

export function buildCategoryComparison(
  currentTotals: Map<string, number>,
  comparisonTotals: Map<string, number>,
): YoYCategoryComparison[] {
  const allCategories = new Set([
    ...currentTotals.keys(),
    ...comparisonTotals.keys(),
  ]);

  const result: YoYCategoryComparison[] = [];

  for (const cat of allCategories) {
    const currentYear = currentTotals.get(cat) ?? 0;
    const comparisonYear = comparisonTotals.get(cat) ?? 0;

    // Exclude categories with zero in both years
    if (currentYear === 0 && comparisonYear === 0) continue;

    const info = categoryMap.get(cat);
    const { change, changePercent, isSignificant } = computeChange(
      currentYear,
      comparisonYear,
    );

    result.push({
      category: cat,
      label: info?.label ?? cat,
      atoCode: info?.atoReference ?? "",
      isKeyExpense: KEY_EXPENSE_SET.has(cat),
      currentYear,
      comparisonYear,
      change,
      changePercent,
      isSignificant,
    });
  }

  return result;
}

export function sortCategories<T extends { category: string; isKeyExpense: boolean }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    // Key expenses first
    if (a.isKeyExpense && !b.isKeyExpense) return -1;
    if (!a.isKeyExpense && b.isKeyExpense) return 1;

    // Within key expenses, sort by ATO reference
    if (a.isKeyExpense && b.isKeyExpense) {
      const aRef = KEY_EXPENSE_ORDER.get(a.category) ?? "";
      const bRef = KEY_EXPENSE_ORDER.get(b.category) ?? "";
      return aRef.localeCompare(bRef);
    }

    // Other categories: alphabetical by label
    const aLabel = categoryMap.get(a.category)?.label ?? a.category;
    const bLabel = categoryMap.get(b.category)?.label ?? b.category;
    return aLabel.localeCompare(bLabel);
  });
}

// --- Helpers ---

function groupByPropertyAndCategory(
  txns: Array<{ propertyId: string | null; category: string; amount: string }>,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const t of txns) {
    if (!t.propertyId) continue;
    const amount = Math.abs(Number(t.amount));

    let propMap = result.get(t.propertyId);
    if (!propMap) {
      propMap = new Map();
      result.set(t.propertyId, propMap);
    }

    propMap.set(t.category, (propMap.get(t.category) ?? 0) + amount);
  }

  return result;
}

function aggregatePortfolio(
  propertyGroups: Map<string, Map<string, number>>,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const propMap of propertyGroups.values()) {
    for (const [cat, amount] of propMap) {
      totals.set(cat, (totals.get(cat) ?? 0) + amount);
    }
  }

  return totals;
}

// --- Main service function ---

export async function buildYoYComparison(
  userId: string,
  currentYear: number,
  comparisonYear: number,
): Promise<YoYComparisonResult> {
  const currentRange = getFinancialYearRange(currentYear);
  const comparisonRange = getFinancialYearRange(comparisonYear);

  // Only include deductible expense categories
  const deductibleCategories = new Set(
    categories.filter((c) => c.isDeductible).map((c) => c.value),
  );

  // Fetch data in parallel
  const [userProperties, currentTxns, comparisonTxns] = await Promise.all([
    db.query.properties.findMany({
      where: eq(properties.userId, userId),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, currentRange.startDate),
        lte(transactions.date, currentRange.endDate),
      ),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, comparisonRange.startDate),
        lte(transactions.date, comparisonRange.endDate),
      ),
    }),
  ]);

  // Filter to deductible expenses only
  const filterDeductible = (
    txns: Array<{ propertyId: string | null; category: string; amount: string }>,
  ) => txns.filter((t) => deductibleCategories.has(t.category));

  const currentGrouped = groupByPropertyAndCategory(
    filterDeductible(
      currentTxns as Array<{ propertyId: string | null; category: string; amount: string }>,
    ),
  );
  const comparisonGrouped = groupByPropertyAndCategory(
    filterDeductible(
      comparisonTxns as Array<{ propertyId: string | null; category: string; amount: string }>,
    ),
  );

  // Portfolio-level comparison
  const currentPortfolio = aggregatePortfolio(currentGrouped);
  const comparisonPortfolio = aggregatePortfolio(comparisonGrouped);
  const portfolioComparison = sortCategories(
    buildCategoryComparison(currentPortfolio, comparisonPortfolio),
  );

  const totalCurrent = portfolioComparison.reduce((s, c) => s + c.currentYear, 0);
  const totalComparison = portfolioComparison.reduce((s, c) => s + c.comparisonYear, 0);
  const totals = computeChange(totalCurrent, totalComparison);

  // Per-property breakdowns
  const allPropertyIds = new Set([
    ...currentGrouped.keys(),
    ...comparisonGrouped.keys(),
  ]);

  const propertyBreakdowns: YoYPropertyBreakdown[] = [];
  for (const propId of allPropertyIds) {
    const prop = userProperties.find((p) => p.id === propId);
    if (!prop) continue;

    const propCurrent = currentGrouped.get(propId) ?? new Map();
    const propComparison = comparisonGrouped.get(propId) ?? new Map();
    const catComparisons = sortCategories(
      buildCategoryComparison(propCurrent, propComparison),
    );

    const propTotalCurrent = catComparisons.reduce((s, c) => s + c.currentYear, 0);
    const propTotalComparison = catComparisons.reduce((s, c) => s + c.comparisonYear, 0);
    const propTotals = computeChange(propTotalCurrent, propTotalComparison);

    propertyBreakdowns.push({
      propertyId: propId,
      address: prop.address,
      categories: catComparisons,
      totalCurrent: propTotalCurrent,
      totalComparison: propTotalComparison,
      totalChange: propTotals.change,
      totalChangePercent: propTotals.changePercent,
    });
  }

  return {
    currentYear,
    comparisonYear,
    currentYearLabel: currentRange.label,
    comparisonYearLabel: comparisonRange.label,
    portfolio: portfolioComparison,
    properties: propertyBreakdowns,
    totalCurrent,
    totalComparison,
    totalChange: totals.change,
    totalChangePercent: totals.changePercent,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/yoy-comparison.test.ts`
Expected: All 11 tests PASS.

**Step 5: Commit**

```bash
git add src/server/services/yoy-comparison.ts src/server/services/__tests__/yoy-comparison.test.ts
git commit -m "feat(yoy): add YoY comparison service with TDD tests"
```

---

### Task 2: tRPC Router

**Files:**
- Create: `src/server/routers/yoyComparison.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/yoyComparison.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildYoYComparison } from "../services/yoy-comparison";

export const yoyComparisonRouter = router({
  getComparison: protectedProcedure
    .input(
      z.object({
        currentYear: z.number().min(2020).max(2030),
        comparisonYear: z.number().min(2020).max(2030),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildYoYComparison(
        ctx.portfolio.ownerId,
        input.currentYear,
        input.comparisonYear,
      );
    }),
});
```

**Step 2: Register in `_app.ts`**

Add import after line 45 (`import { taxForecastRouter } from "./taxForecast";`):

```typescript
import { yoyComparisonRouter } from "./yoyComparison";
```

Add to the router object after line 91 (`taxForecast: taxForecastRouter,`):

```typescript
  yoyComparison: yoyComparisonRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/yoyComparison.ts src/server/routers/_app.ts
git commit -m "feat(yoy): add YoY comparison tRPC router"
```

---

### Task 3: YoY Comparison Table Component

**Files:**
- Create: `src/components/reports/YoYComparisonTable.tsx`

**Step 1: Create the reusable table component**

Create `src/components/reports/YoYComparisonTable.tsx`:

```typescript
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface CategoryRow {
  category: string;
  label: string;
  atoCode: string;
  isKeyExpense: boolean;
  currentYear: number;
  comparisonYear: number;
  change: number;
  changePercent: number | null;
  isSignificant: boolean;
}

interface YoYComparisonTableProps {
  categories: CategoryRow[];
  currentYearLabel: string;
  comparisonYearLabel: string;
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}

function ChangeIndicator({ change, changePercent }: { change: number; changePercent: number | null }) {
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>0%</span>
      </span>
    );
  }

  // For expenses: increase = bad (amber), decrease = good (green)
  const isIncrease = change > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        isIncrease ? "text-amber-600" : "text-green-600",
      )}
    >
      {isIncrease ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      <span>{changePercent !== null ? `${Math.abs(changePercent)}%` : "New"}</span>
    </span>
  );
}

export function YoYComparisonTable({
  categories,
  currentYearLabel,
  comparisonYearLabel,
  totalCurrent,
  totalComparison,
  totalChange,
  totalChangePercent,
}: YoYComparisonTableProps) {
  const keyExpenses = categories.filter((c) => c.isKeyExpense);
  const otherExpenses = categories.filter((c) => !c.isKeyExpense);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Category</TableHead>
          <TableHead className="text-right">{comparisonYearLabel}</TableHead>
          <TableHead className="text-right">{currentYearLabel}</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead className="text-right">% Change</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keyExpenses.map((row) => (
          <TableRow
            key={row.category}
            className={cn(
              "border-l-2 border-l-blue-400",
              row.isSignificant && "bg-amber-50",
            )}
          >
            <TableCell className="font-medium">
              {row.label}
              <span className="ml-2 text-xs text-muted-foreground">{row.atoCode}</span>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(row.comparisonYear)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.currentYear)}</TableCell>
            <TableCell className={cn("text-right", row.change > 0 ? "text-amber-600" : row.change < 0 ? "text-green-600" : "")}>
              {row.change !== 0 ? (row.change > 0 ? "+" : "") + formatCurrency(row.change) : "-"}
            </TableCell>
            <TableCell className="text-right">
              <ChangeIndicator change={row.change} changePercent={row.changePercent} />
            </TableCell>
          </TableRow>
        ))}

        {keyExpenses.length > 0 && otherExpenses.length > 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-1">
              <div className="border-t border-dashed" />
            </TableCell>
          </TableRow>
        )}

        {otherExpenses.map((row) => (
          <TableRow
            key={row.category}
            className={cn(row.isSignificant && "bg-amber-50")}
          >
            <TableCell className="font-medium">
              {row.label}
              <span className="ml-2 text-xs text-muted-foreground">{row.atoCode}</span>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(row.comparisonYear)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.currentYear)}</TableCell>
            <TableCell className={cn("text-right", row.change > 0 ? "text-amber-600" : row.change < 0 ? "text-green-600" : "")}>
              {row.change !== 0 ? (row.change > 0 ? "+" : "") + formatCurrency(row.change) : "-"}
            </TableCell>
            <TableCell className="text-right">
              <ChangeIndicator change={row.change} changePercent={row.changePercent} />
            </TableCell>
          </TableRow>
        ))}

        <TableRow className="font-bold border-t-2">
          <TableCell>Total Expenses</TableCell>
          <TableCell className="text-right">{formatCurrency(totalComparison)}</TableCell>
          <TableCell className="text-right">{formatCurrency(totalCurrent)}</TableCell>
          <TableCell className={cn("text-right", totalChange > 0 ? "text-amber-600" : totalChange < 0 ? "text-green-600" : "")}>
            {totalChange !== 0 ? (totalChange > 0 ? "+" : "") + formatCurrency(totalChange) : "-"}
          </TableCell>
          <TableCell className="text-right">
            <ChangeIndicator change={totalChange} changePercent={totalChangePercent} />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reports/YoYComparisonTable.tsx
git commit -m "feat(yoy): add YoY comparison table component"
```

---

### Task 4: Report Page Content Component

**Files:**
- Create: `src/components/reports/YoYComparisonContent.tsx`

**Step 1: Create the client component**

Create `src/components/reports/YoYComparisonContent.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc/client";
import { YoYComparisonTable } from "./YoYComparisonTable";
import { ChevronDown, Loader2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function YoYComparisonContent() {
  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();

  // Default to current FY (most recent year)
  const currentYear = availableYears?.[0]?.year;
  const priorYears = availableYears?.filter((y) => y.year !== currentYear) ?? [];

  const [comparisonYear, setComparisonYear] = useState<number | undefined>(undefined);

  // Use prior year as default once available
  const effectiveComparisonYear = comparisonYear ?? (priorYears[0]?.year);

  const { data, isLoading } = trpc.yoyComparison.getComparison.useQuery(
    { currentYear: currentYear!, comparisonYear: effectiveComparisonYear! },
    { enabled: !!currentYear && !!effectiveComparisonYear },
  );

  if (!availableYears || availableYears.length < 2) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Year-over-Year Comparison</h2>
          <p className="text-muted-foreground">
            Compare expense categories across financial years
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              You need at least two financial years of data to compare. Keep tracking your expenses and check back next financial year.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Year-over-Year Comparison</h2>
          <p className="text-muted-foreground">
            Compare expense categories across financial years
          </p>
        </div>
        {priorYears.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Compare against:</span>
            <Select
              value={String(effectiveComparisonYear)}
              onValueChange={(v) => setComparisonYear(Number(v))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorYears.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* Portfolio Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Portfolio Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.portfolio.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expense data found for either financial year.
                </p>
              ) : (
                <YoYComparisonTable
                  categories={data.portfolio}
                  currentYearLabel={data.currentYearLabel}
                  comparisonYearLabel={data.comparisonYearLabel}
                  totalCurrent={data.totalCurrent}
                  totalComparison={data.totalComparison}
                  totalChange={data.totalChange}
                  totalChangePercent={data.totalChangePercent}
                />
              )}
            </CardContent>
          </Card>

          {/* Per-Property Breakdowns */}
          {data.properties.map((prop) => (
            <Collapsible key={prop.propertyId}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{prop.address}</CardTitle>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <YoYComparisonTable
                      categories={prop.categories}
                      currentYearLabel={data.currentYearLabel}
                      comparisonYearLabel={data.comparisonYearLabel}
                      totalCurrent={prop.totalCurrent}
                      totalComparison={prop.totalComparison}
                      totalChange={prop.totalChange}
                      totalChangePercent={prop.totalChangePercent}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reports/YoYComparisonContent.tsx
git commit -m "feat(yoy): add YoY comparison page content component"
```

---

### Task 5: Page Wrapper & Reports Hub Link

**Files:**
- Create: `src/app/(dashboard)/reports/yoy-comparison/page.tsx`
- Modify: `src/app/(dashboard)/reports/page.tsx`

**Step 1: Create the page wrapper**

Create `src/app/(dashboard)/reports/yoy-comparison/page.tsx`:

```typescript
import { Suspense } from "react";
import { YoYComparisonContent } from "@/components/reports/YoYComparisonContent";

export const dynamic = "force-dynamic";

function YoYComparisonLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Year-over-Year Comparison</h2>
        <p className="text-muted-foreground">
          Compare expense categories across financial years
        </p>
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function YoYComparisonPage() {
  return (
    <Suspense fallback={<YoYComparisonLoading />}>
      <YoYComparisonContent />
    </Suspense>
  );
}
```

**Step 2: Add the 7th card to the reports hub**

In `src/app/(dashboard)/reports/page.tsx`, add `BarChart3` to the Lucide import:

```typescript
import { FileText, PieChart, Download, TrendingUp, Calculator, ClipboardList, BarChart3 } from "lucide-react";
```

Add a new entry at the end of the `reportTypes` array (after the MyTax Export entry):

```typescript
  {
    title: "Year-over-Year",
    description: "Compare key expenses across financial years to spot anomalies and trends",
    icon: BarChart3,
    href: "/reports/yoy-comparison",
  },
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/yoy-comparison/page.tsx src/app/\(dashboard\)/reports/page.tsx
git commit -m "feat(yoy): add report page and reports hub link"
```

---

### Task 6: Type Check and Final Verification

**Files:** None (verification only)

**Step 1: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass (including the 11 new yoy-comparison tests).

**Step 3: Run linter on changed files**

Run: `npx eslint src/server/services/yoy-comparison.ts src/server/routers/yoyComparison.ts src/components/reports/YoYComparisonTable.tsx src/components/reports/YoYComparisonContent.tsx src/app/\(dashboard\)/reports/yoy-comparison/page.tsx src/app/\(dashboard\)/reports/page.tsx`
Expected: No errors or warnings.

**Step 4: Fix any issues found in steps 1-3, then commit**

```bash
git add -A
git commit -m "fix(yoy): resolve lint and type check issues"
```

(Skip this commit if steps 1-3 are clean.)
