# Tax Position Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance `/reports/tax-position` with per-property breakdown, tax optimization suggestions, and visual polish.

**Architecture:** Add one new tRPC query (`getPropertyBreakdown`) that groups FY transactions by property and ATO category. Extract the existing monolithic `TaxPositionContent` into focused sub-components (`TaxHeroCard`, `TaxSummaryStrip`, `PropertyBreakdownTable`, `TaxOptimizationSection`). Redesign the page layout with collapsible profile editing and a scrollable single-page dashboard feel.

**Tech Stack:** tRPC v11, Drizzle ORM, React 19, shadcn/ui (Collapsible, Card, Badge, Table), Tailwind v4, Vitest

**Tech Notes:** Context7 quota exceeded — patterns verified against existing codebase. Collapsible component confirmed at `src/components/ui/collapsible.tsx`. Categories metadata at `src/lib/categories.ts` provides `categoryMap` with ATO references. `getFinancialYearRange()` from `src/server/services/transaction/reports.ts` returns `{ startDate, endDate }`. Existing `calculatePropertyMetrics()` handles income/expense summation.

---

### Task 1: `getPropertyBreakdown` tRPC Procedure

**Files:**
- Modify: `src/server/routers/tax/taxPosition.ts`
- Reference: `src/lib/categories.ts` (categoryMap, getCategoryInfo)
- Reference: `src/server/services/transaction/reports.ts` (getFinancialYearRange)
- Test: `src/server/routers/tax/__tests__/taxPosition.getPropertyBreakdown.test.ts`

**Step 1: Write the failing test**

Create `src/server/routers/tax/__tests__/taxPosition.getPropertyBreakdown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { groupTransactionsByProperty } from "../taxPosition";

describe("groupTransactionsByProperty", () => {
  it("groups transactions by property with category breakdown", () => {
    const transactions = [
      { propertyId: "p1", category: "rental_income", amount: "2000", transactionType: "income" },
      { propertyId: "p1", category: "interest_on_loans", amount: "-500", transactionType: "expense" },
      { propertyId: "p1", category: "council_rates", amount: "-300", transactionType: "expense" },
      { propertyId: "p2", category: "rental_income", amount: "1500", transactionType: "income" },
      { propertyId: "p2", category: "insurance", amount: "-200", transactionType: "expense" },
    ];
    const properties = [
      { id: "p1", address: "1 Test St", suburb: "Testville" },
      { id: "p2", address: "2 Demo Ave", suburb: "Demoton" },
    ];

    const result = groupTransactionsByProperty(transactions, properties);

    expect(result.properties).toHaveLength(2);

    const p1 = result.properties.find((p) => p.propertyId === "p1")!;
    expect(p1.address).toBe("1 Test St");
    expect(p1.income).toBe(2000);
    expect(p1.expenses).toBe(800);
    expect(p1.netResult).toBe(1200);
    expect(p1.categories).toHaveLength(3);
    expect(p1.categories.find((c) => c.category === "interest_on_loans")?.amount).toBe(500);
    expect(p1.categories.find((c) => c.category === "interest_on_loans")?.atoReference).toBe("D8");

    expect(result.totals.income).toBe(3500);
    expect(result.totals.expenses).toBe(1000);
    expect(result.totals.netResult).toBe(2500);
  });

  it("puts transactions without propertyId into unallocated", () => {
    const transactions = [
      { propertyId: null, category: "rental_income", amount: "1000", transactionType: "income" },
      { propertyId: null, category: "insurance", amount: "-200", transactionType: "expense" },
    ];

    const result = groupTransactionsByProperty(transactions, []);

    expect(result.properties).toHaveLength(0);
    expect(result.unallocated.income).toBe(1000);
    expect(result.unallocated.expenses).toBe(200);
    expect(result.unallocated.categories).toHaveLength(2);
  });

  it("returns empty results for no transactions", () => {
    const result = groupTransactionsByProperty([], []);

    expect(result.properties).toHaveLength(0);
    expect(result.totals.income).toBe(0);
    expect(result.totals.expenses).toBe(0);
    expect(result.totals.netResult).toBe(0);
  });

  it("excludes capital and other category types from breakdown", () => {
    const transactions = [
      { propertyId: "p1", category: "stamp_duty", amount: "-50000", transactionType: "expense" },
      { propertyId: "p1", category: "transfer", amount: "100", transactionType: "income" },
      { propertyId: "p1", category: "rental_income", amount: "2000", transactionType: "income" },
    ];
    const properties = [{ id: "p1", address: "1 Test St", suburb: "Testville" }];

    const result = groupTransactionsByProperty(transactions, properties);
    const p1 = result.properties[0];
    // Only rental_income should appear (income/expense types)
    // stamp_duty is capital type, transfer is other type — excluded
    expect(p1.categories).toHaveLength(1);
    expect(p1.categories[0].category).toBe("rental_income");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/tax/__tests__/taxPosition.getPropertyBreakdown.test.ts`
Expected: FAIL — `groupTransactionsByProperty` not exported

**Step 3: Implement the grouping function and tRPC procedure**

Add to `src/server/routers/tax/taxPosition.ts`:

1. Import `getCategoryInfo` from `@/lib/categories`
2. Export the pure function `groupTransactionsByProperty` (testable, no DB dependency)
3. Add `getPropertyBreakdown` procedure that queries FY transactions + properties, calls the grouping function

```typescript
// Add imports at top of file
import { getCategoryInfo } from "@/lib/categories";

// Types for the breakdown
interface CategoryBreakdown {
  category: string;
  label: string;
  atoReference: string;
  amount: number;
  transactionCount: number;
}

interface PropertyBreakdown {
  propertyId: string;
  address: string;
  suburb: string;
  income: number;
  expenses: number;
  netResult: number;
  categories: CategoryBreakdown[];
}

interface PropertyBreakdownResult {
  properties: PropertyBreakdown[];
  unallocated: {
    income: number;
    expenses: number;
    netResult: number;
    categories: CategoryBreakdown[];
  };
  totals: {
    income: number;
    expenses: number;
    netResult: number;
  };
}

// Pure function — exported for testing
export function groupTransactionsByProperty(
  txns: Array<{ propertyId: string | null; category: string; amount: string; transactionType: string }>,
  properties: Array<{ id: string; address: string; suburb: string }>
): PropertyBreakdownResult {
  const propertyMap = new Map(properties.map((p) => [p.id, p]));
  const groups = new Map<string | null, typeof txns>();

  // Group transactions by propertyId
  for (const t of txns) {
    const info = getCategoryInfo(t.category);
    // Only include income and deductible expense categories
    if (!info || (info.type !== "income" && info.type !== "expense")) continue;

    const key = t.propertyId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const buildCategories = (groupTxns: typeof txns): CategoryBreakdown[] => {
    const catMap = new Map<string, { amount: number; count: number }>();
    for (const t of groupTxns) {
      const curr = catMap.get(t.category) || { amount: 0, count: 0 };
      curr.amount += Math.abs(Number(t.amount));
      curr.count += 1;
      catMap.set(t.category, curr);
    }

    return Array.from(catMap.entries())
      .map(([cat, data]) => {
        const info = getCategoryInfo(cat);
        return {
          category: cat,
          label: info?.label ?? cat,
          atoReference: info?.atoReference ?? "",
          amount: data.amount,
          transactionCount: data.count,
        };
      })
      .sort((a, b) => a.atoReference.localeCompare(b.atoReference, undefined, { numeric: true }));
  };

  const buildTotals = (groupTxns: typeof txns) => {
    let income = 0;
    let expenses = 0;
    for (const t of groupTxns) {
      if (t.transactionType === "income") income += Number(t.amount);
      else if (t.transactionType === "expense") expenses += Math.abs(Number(t.amount));
    }
    return { income, expenses, netResult: income - expenses };
  };

  // Build per-property results
  const propertyResults: PropertyBreakdown[] = [];
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const [propId, groupTxns] of groups) {
    if (propId === null) continue;
    const prop = propertyMap.get(propId);
    const totals = buildTotals(groupTxns);
    totalIncome += totals.income;
    totalExpenses += totals.expenses;

    propertyResults.push({
      propertyId: propId,
      address: prop?.address ?? "Unknown property",
      suburb: prop?.suburb ?? "",
      ...totals,
      categories: buildCategories(groupTxns),
    });
  }

  // Sort by highest expense first
  propertyResults.sort((a, b) => b.expenses - a.expenses);

  // Build unallocated
  const unallocatedTxns = groups.get(null) ?? [];
  const unallocatedTotals = buildTotals(unallocatedTxns);
  totalIncome += unallocatedTotals.income;
  totalExpenses += unallocatedTotals.expenses;

  return {
    properties: propertyResults,
    unallocated: {
      ...unallocatedTotals,
      categories: buildCategories(unallocatedTxns),
    },
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      netResult: totalIncome - totalExpenses,
    },
  };
}
```

Then add the procedure inside the `taxPositionRouter`:

```typescript
  getPropertyBreakdown: protectedProcedure
    .input(z.object({ financialYear: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = getFinancialYearRange(input.financialYear);

      // Cross-domain: queries transactions + properties for per-property tax breakdown
      const [txns, props] = await Promise.all([
        ctx.db.query.transactions.findMany({
          where: and(
            eq(transactions.userId, ctx.portfolio.ownerId),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          ),
        }),
        ctx.uow.property.findByOwner(ctx.portfolio.ownerId),
      ]);

      return groupTransactionsByProperty(
        txns.map((t) => ({
          propertyId: t.propertyId,
          category: t.category,
          amount: t.amount,
          transactionType: t.transactionType,
        })),
        props.map((p) => ({ id: p.id, address: p.address, suburb: p.suburb }))
      );
    }),
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/routers/tax/__tests__/taxPosition.getPropertyBreakdown.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/server/routers/tax/taxPosition.ts src/server/routers/tax/__tests__/taxPosition.getPropertyBreakdown.test.ts
git commit -m "feat: add getPropertyBreakdown tRPC procedure with per-property tax grouping"
```

---

### Task 2: `TaxHeroCard` Component

**Files:**
- Create: `src/components/tax-position/TaxHeroCard.tsx`
- Reference: `src/components/ui/card.tsx` (Card, CardContent)
- Reference: `src/components/tax-position/ForecastSummary.tsx`
- Reference: `src/components/tax-position/ConfidenceBadge.tsx`

**Step 1: Create the component**

Create `src/components/tax-position/TaxHeroCard.tsx`:

```tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface TaxHeroCardProps {
  refundOrOwing: number;
  isRefund: boolean;
  propertySavings: number;
  forecast?: {
    refundOrOwing: number;
    isRefund: boolean;
  } | null;
  monthsElapsed?: number;
  confidence?: "high" | "medium" | "low";
}

export function TaxHeroCard({
  refundOrOwing,
  isRefund,
  propertySavings,
  forecast,
  monthsElapsed,
  confidence,
}: TaxHeroCardProps) {
  const showForecast = forecast && monthsElapsed != null && monthsElapsed < 12;

  return (
    <Card
      className={cn(
        "border-0 shadow-lg",
        isRefund
          ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30"
          : "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30"
      )}
    >
      <CardContent className="pt-8 pb-6">
        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {isRefund ? "Estimated Refund" : "Estimated Owing"}
          </p>
          <p
            className={cn(
              "text-5xl font-bold tracking-tight",
              isRefund ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
            )}
          >
            {formatCurrency(Math.abs(refundOrOwing))}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {propertySavings > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Home className="h-3 w-3" />
                Properties saved you {formatCurrency(propertySavings)}
              </Badge>
            )}
            {showForecast && (
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                Full year: {formatCurrency(Math.abs(forecast.refundOrOwing))}{" "}
                {forecast.isRefund ? "refund" : "owing"}
              </Badge>
            )}
            {confidence && <ConfidenceBadge confidence={confidence} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tax-position/TaxHeroCard.tsx
git commit -m "feat: add TaxHeroCard component with gradient and badges"
```

---

### Task 3: `TaxSummaryStrip` Component

**Files:**
- Create: `src/components/tax-position/TaxSummaryStrip.tsx`
- Reference: `src/components/ui/card.tsx`

**Step 1: Create the component**

Create `src/components/tax-position/TaxSummaryStrip.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface TaxSummaryStripProps {
  taxableIncome: number;
  marginalRate: number;
  totalDeductions: number;
  propertySavings: number;
}

export function TaxSummaryStrip({
  taxableIncome,
  marginalRate,
  totalDeductions,
  propertySavings,
}: TaxSummaryStripProps) {
  const stats = [
    { label: "Taxable Income", value: formatCurrency(taxableIncome) },
    { label: "Marginal Rate", value: `${marginalRate}%` },
    { label: "Total Deductions", value: formatCurrency(totalDeductions) },
    { label: "Property Savings", value: formatCurrency(propertySavings) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-semibold mt-0.5">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tax-position/TaxSummaryStrip.tsx
git commit -m "feat: add TaxSummaryStrip component with 4-stat row"
```

---

### Task 4: `PropertyBreakdownTable` Component

**Files:**
- Create: `src/components/tax-position/PropertyBreakdownTable.tsx`
- Reference: `src/components/ui/collapsible.tsx` (Collapsible, CollapsibleTrigger, CollapsibleContent)
- Reference: `src/components/ui/card.tsx`
- Reference: `src/components/ui/badge.tsx`

**Step 1: Create the component**

Create `src/components/tax-position/PropertyBreakdownTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, AlertTriangle, Building2 } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";

interface CategoryBreakdown {
  category: string;
  label: string;
  atoReference: string;
  amount: number;
  transactionCount: number;
}

interface PropertyBreakdown {
  propertyId: string;
  address: string;
  suburb: string;
  income: number;
  expenses: number;
  netResult: number;
  categories: CategoryBreakdown[];
}

interface PropertyBreakdownTableProps {
  properties: PropertyBreakdown[];
  unallocated: {
    income: number;
    expenses: number;
    netResult: number;
    categories: CategoryBreakdown[];
  };
  totals: {
    income: number;
    expenses: number;
    netResult: number;
  };
  financialYear: number;
}

function PropertyRow({ property, financialYear }: { property: PropertyBreakdown; financialYear: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 py-3 px-4 hover:bg-muted/50 transition-colors text-left">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                open && "rotate-90"
              )}
            />
            <div className="truncate">
              <p className="text-sm font-medium truncate">{property.address}</p>
              <p className="text-xs text-muted-foreground">{property.suburb}</p>
            </div>
          </div>
          <span className="text-sm text-right tabular-nums text-green-600">
            {formatCurrency(property.income)}
          </span>
          <span className="text-sm text-right tabular-nums text-red-600">
            {formatCurrency(property.expenses)}
          </span>
          <span
            className={cn(
              "text-sm font-medium text-right tabular-nums",
              property.netResult >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {formatCurrency(property.netResult)}
          </span>
          <span className="text-xs text-muted-foreground w-16 text-right">
            {property.categories.reduce((sum, c) => sum + c.transactionCount, 0)} txns
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-10 pr-4 pb-3 space-y-1">
          {property.categories.map((cat) => (
            <Link
              key={cat.category}
              href={`/transactions?propertyId=${property.propertyId}&category=${cat.category}`}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
            >
              {cat.atoReference ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {cat.atoReference}
                </Badge>
              ) : (
                <span className="w-8" />
              )}
              <span className="text-sm text-muted-foreground">{cat.label}</span>
              <span className="text-sm tabular-nums">{formatCurrency(cat.amount)}</span>
              <span className="text-xs text-muted-foreground">{cat.transactionCount}</span>
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PropertyBreakdownTable({
  properties,
  unallocated,
  totals,
  financialYear,
}: PropertyBreakdownTableProps) {
  const hasData = properties.length > 0 || unallocated.categories.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Per-Property Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!hasData ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No rental transactions recorded for this financial year
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground border-b">
              <span className="pl-6">Property</span>
              <span className="text-right">Income</span>
              <span className="text-right">Expenses</span>
              <span className="text-right">Net</span>
              <span className="w-16 text-right">Count</span>
            </div>

            {/* Property rows */}
            <div className="divide-y">
              {properties.map((prop) => (
                <PropertyRow
                  key={prop.propertyId}
                  property={prop}
                  financialYear={financialYear}
                />
              ))}

              {/* Unallocated row */}
              {unallocated.categories.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 py-3 px-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          Unallocated
                        </p>
                        <Link
                          href="/transactions?propertyId=none"
                          className="text-xs text-amber-600 dark:text-amber-500 hover:underline"
                        >
                          Assign to a property
                        </Link>
                      </div>
                    </div>
                    <span className="text-sm text-right tabular-nums">
                      {formatCurrency(unallocated.income)}
                    </span>
                    <span className="text-sm text-right tabular-nums">
                      {formatCurrency(unallocated.expenses)}
                    </span>
                    <span className="text-sm font-medium text-right tabular-nums">
                      {formatCurrency(unallocated.netResult)}
                    </span>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {unallocated.categories.reduce((sum, c) => sum + c.transactionCount, 0)} txns
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-t bg-muted/30 font-medium text-sm">
              <span className="pl-6">Total</span>
              <span className="text-right tabular-nums text-green-600">
                {formatCurrency(totals.income)}
              </span>
              <span className="text-right tabular-nums text-red-600">
                {formatCurrency(totals.expenses)}
              </span>
              <span
                className={cn(
                  "text-right tabular-nums",
                  totals.netResult >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(totals.netResult)}
              </span>
              <span className="w-16" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tax-position/PropertyBreakdownTable.tsx
git commit -m "feat: add PropertyBreakdownTable with expandable category rows"
```

---

### Task 5: `TaxOptimizationSection` Component

**Files:**
- Create: `src/components/tax-position/TaxOptimizationSection.tsx`
- Reference: `src/server/routers/tax/taxOptimization.ts` (getSuggestions procedure)
- Reference: `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`

**Step 1: Create the component**

Create `src/components/tax-position/TaxOptimizationSection.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, X, Check, DollarSign } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface TaxOptimizationSectionProps {
  financialYear: number;
}

export function TaxOptimizationSection({ financialYear }: TaxOptimizationSectionProps) {
  const utils = trpc.useUtils();
  const { data: suggestions } = trpc.taxOptimization.getSuggestions.useQuery({
    financialYear,
    status: "active",
  });

  const dismiss = trpc.taxOptimization.dismissSuggestion.useMutation({
    onSuccess: () => {
      utils.taxOptimization.getSuggestions.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const markActioned = trpc.taxOptimization.markActioned.useMutation({
    onSuccess: () => {
      utils.taxOptimization.getSuggestions.invalidate();
      toast.success("Marked as done");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Tax Optimization Tips
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-start justify-between gap-4 rounded-lg border p-3"
          >
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium">{s.title}</p>
              {s.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {s.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {s.estimatedSavings && Number(s.estimatedSavings) > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(Number(s.estimatedSavings))}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => markActioned.mutate({ suggestionId: s.id })}
                title="Mark as done"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => dismiss.mutate({ suggestionId: s.id })}
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tax-position/TaxOptimizationSection.tsx
git commit -m "feat: add TaxOptimizationSection component with suggestion cards"
```

---

### Task 6: Redesign `TaxPositionContent.tsx`

**Files:**
- Modify: `src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx`
- Modify: `src/components/tax-position/index.ts` (update barrel export)

This is the main integration task. The redesigned page:

1. Replaces the inline hero card with `TaxHeroCard`
2. Adds `TaxSummaryStrip` below the hero
3. Wraps the income/deductions/settings forms in a collapsible "Edit Tax Profile" section (defaults to collapsed when profile is complete)
4. Keeps the Tax Calculation card as-is
5. Adds `PropertyBreakdownTable` from the new `getPropertyBreakdown` query
6. Adds `TaxOptimizationSection` at the bottom
7. Adds `getPropertyBreakdown` and `taxOptimization.getSuggestions` to the data queries

**Step 1: Update barrel export**

Modify `src/components/tax-position/index.ts` to include new components:

```typescript
export { TaxPositionCard } from "./TaxPositionCard";
export { SetupWizard } from "./SetupWizard";
export { ForecastSummary } from "./ForecastSummary";
export { ForecastAnnotation } from "./ForecastAnnotation";
export { ConfidenceBadge } from "./ConfidenceBadge";
export { TaxHeroCard } from "./TaxHeroCard";
export { TaxSummaryStrip } from "./TaxSummaryStrip";
export { PropertyBreakdownTable } from "./PropertyBreakdownTable";
export { TaxOptimizationSection } from "./TaxOptimizationSection";
```

**Step 2: Rewrite `TaxPositionContent.tsx`**

Replace the entire component with the redesigned version. Key changes:

- Import new components: `TaxHeroCard`, `TaxSummaryStrip`, `PropertyBreakdownTable`, `TaxOptimizationSection`
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`
- Add `getPropertyBreakdown` query (parallel with existing queries)
- Replace inline hero card with `<TaxHeroCard />`
- Add `<TaxSummaryStrip />` below hero
- Wrap income/deductions/settings sections in `<Collapsible>` with "Edit Tax Profile" trigger
- Default collapsed when `profile?.isComplete`
- Keep Tax Calculation card (existing code)
- Add `<PropertyBreakdownTable />` section
- Add `<TaxOptimizationSection />` at bottom

The full rewrite is large — the implementer should:
1. Read the current `TaxPositionContent.tsx` (638 lines)
2. Keep all existing state management, queries, form handling, save/reset logic
3. Replace the JSX return statement with the new layout using the extracted components
4. Add the new `getPropertyBreakdown` query alongside existing queries
5. Add `profileOpen` state for the collapsible, initialized to `!profile?.isComplete`

**Step 3: Run type check**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "(TaxPositionContent|TaxHeroCard|TaxSummaryStrip|PropertyBreakdownTable|TaxOptimizationSection)"`
Expected: No errors in these files

**Step 4: Commit**

```bash
git add src/components/tax-position/index.ts src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx
git commit -m "feat: redesign tax position page with per-property breakdown and visual polish"
```

---

### Task 7: Manual Verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to `/reports/tax-position`**

Verify:
- [ ] Hero card shows refund/owing with gradient background
- [ ] Summary strip shows 4 stat cards
- [ ] Profile edit section is collapsible (collapsed when profile exists)
- [ ] Per-property breakdown table renders with expandable rows
- [ ] Category rows show ATO references and link to filtered transactions
- [ ] Unallocated section appears when transactions lack propertyId
- [ ] Tax optimization tips appear when suggestions exist
- [ ] Setup wizard still works for new profiles
- [ ] FY selector still works

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass + new getPropertyBreakdown tests pass

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address any issues found during manual verification"
```
