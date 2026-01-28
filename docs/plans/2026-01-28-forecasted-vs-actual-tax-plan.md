# Forecasted vs Actual Tax Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full-year tax forecasting as inline annotations on the tax position page and dashboard card, using a hybrid algorithm (YTD actuals + prior year fill-in).

**Architecture:** New `tax-forecast.ts` service computes projected annual figures per property per category by combining current FY actuals with prior FY monthly patterns. A new `taxForecast` tRPC router exposes this. Frontend changes add forecast annotations inline on the tax position page and a one-line projection on the dashboard card.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM, React, Vitest

---

### Task 1: Forecast Service - Core Algorithm

**Files:**
- Create: `src/server/services/tax-forecast.ts`
- Create: `src/server/services/__tests__/tax-forecast.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/server/services/__tests__/tax-forecast.test.ts

import { describe, expect, it } from "vitest";
import {
  computeCategoryForecast,
  computeConfidence,
  type MonthlyTotals,
} from "../tax-forecast";

describe("computeCategoryForecast", () => {
  it("uses prior year to fill remaining months", () => {
    // 6 months elapsed (Jul-Dec), current FY has $600/mo = $3600 YTD
    // Prior year had $500/mo for Jan-Jun = $3000 fill-in
    const currentMonths: MonthlyTotals = { 7: 600, 8: 600, 9: 600, 10: 600, 11: 600, 12: 600 };
    const priorMonths: MonthlyTotals = { 1: 500, 2: 500, 3: 500, 4: 500, 5: 500, 6: 500, 7: 500, 8: 500, 9: 500, 10: 500, 11: 500, 12: 500 };

    const result = computeCategoryForecast(currentMonths, priorMonths, 6);
    // actual YTD = 3600, fill-in from prior year Jan-Jun = 3000
    expect(result.actual).toBe(3600);
    expect(result.forecast).toBe(6600);
  });

  it("annualizes when no prior year data exists", () => {
    const currentMonths: MonthlyTotals = { 7: 1000, 8: 1000, 9: 1000 };
    const priorMonths: MonthlyTotals = {};

    const result = computeCategoryForecast(currentMonths, priorMonths, 3);
    expect(result.actual).toBe(3000);
    // 3000 / 3 * 12 = 12000
    expect(result.forecast).toBe(12000);
  });

  it("handles seasonal payments via prior year pattern", () => {
    // Insurance paid in March only
    const currentMonths: MonthlyTotals = { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    const priorMonths: MonthlyTotals = { 1: 0, 2: 0, 3: 2100, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };

    const result = computeCategoryForecast(currentMonths, priorMonths, 6);
    expect(result.actual).toBe(0);
    expect(result.forecast).toBe(2100); // picks up March from prior year
  });

  it("returns zero forecast when no data at all", () => {
    const result = computeCategoryForecast({}, {}, 0);
    expect(result.actual).toBe(0);
    expect(result.forecast).toBe(0);
  });
});

describe("computeConfidence", () => {
  it("returns high when 9+ months elapsed", () => {
    expect(computeConfidence(9, true)).toBe("high");
    expect(computeConfidence(10, false)).toBe("high");
  });

  it("returns high when prior year data available", () => {
    expect(computeConfidence(4, true)).toBe("high");
  });

  it("returns medium for 4-8 months without prior year", () => {
    expect(computeConfidence(5, false)).toBe("medium");
  });

  it("returns low for <4 months without prior year", () => {
    expect(computeConfidence(2, false)).toBe("low");
    expect(computeConfidence(0, false)).toBe("low");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/__tests__/tax-forecast.test.ts`
Expected: FAIL - module not found

**Step 3: Write the service implementation**

```typescript
// src/server/services/tax-forecast.ts

import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { transactions, properties, taxProfiles, depreciationSchedules } from "@/server/db/schema";
import { categories } from "@/lib/categories";
import {
  getFinancialYearRange,
  calculateCategoryTotals,
} from "./reports";
import { calculateTaxPosition, type TaxPositionResult } from "./tax-position";
import { getCurrentFinancialYear } from "@/lib/tax-tables";

// --- Types ---

/** Monthly totals keyed by month number (1=Jan, 12=Dec) */
export type MonthlyTotals = Record<number, number>;

export type Confidence = "high" | "medium" | "low";

export interface CategoryForecast {
  category: string;
  label: string;
  atoCode: string;
  actual: number;
  forecast: number;
  confidence: Confidence;
}

export interface PropertyForecast {
  propertyId: string;
  address: string;
  categories: CategoryForecast[];
  totalIncome: { actual: number; forecast: number };
  totalDeductions: { actual: number; forecast: number };
  netResult: { actual: number; forecast: number };
}

export interface TaxForecastResult {
  financialYear: number;
  monthsElapsed: number;
  properties: PropertyForecast[];
  totalIncome: { actual: number; forecast: number };
  totalDeductions: { actual: number; forecast: number };
  netRentalResult: { actual: number; forecast: number };
  taxPosition: {
    actual: TaxPositionResult | null;
    forecast: TaxPositionResult | null;
  };
  confidence: Confidence;
}

// --- Pure functions (exported for testing) ---

export function computeCategoryForecast(
  currentMonths: MonthlyTotals,
  priorMonths: MonthlyTotals,
  monthsElapsed: number,
): { actual: number; forecast: number } {
  const actual = Object.values(currentMonths).reduce((sum, v) => sum + v, 0);

  if (monthsElapsed === 0 && Object.keys(currentMonths).length === 0) {
    return { actual: 0, forecast: 0 };
  }

  // Determine which months are remaining in the FY
  // AU FY runs Jul(7)-Jun(6). Elapsed months start from July.
  // If 6 months elapsed, we have Jul-Dec, remaining is Jan-Jun
  const elapsedMonthNumbers: number[] = [];
  const remainingMonthNumbers: number[] = [];
  for (let i = 0; i < 12; i++) {
    // FY month order: 7,8,9,10,11,12,1,2,3,4,5,6
    const month = ((i + 6) % 12) + 1;
    if (i < monthsElapsed) {
      elapsedMonthNumbers.push(month);
    } else {
      remainingMonthNumbers.push(month);
    }
  }

  // Check if prior year has data for remaining months
  const hasPriorForRemaining = remainingMonthNumbers.some(
    (m) => (priorMonths[m] ?? 0) !== 0
  );
  const hasPriorData = Object.keys(priorMonths).length > 0;

  if (remainingMonthNumbers.length === 0) {
    // Full year of actuals
    return { actual, forecast: actual };
  }

  if (hasPriorData) {
    // Hybrid: actuals + prior year fill-in for remaining months
    const fillIn = remainingMonthNumbers.reduce(
      (sum, m) => sum + (priorMonths[m] ?? 0),
      0
    );
    return { actual, forecast: actual + fillIn };
  }

  // No prior year: annualize
  if (monthsElapsed === 0) {
    return { actual: 0, forecast: 0 };
  }
  return { actual, forecast: Math.round((actual / monthsElapsed) * 12) };
}

export function computeConfidence(
  monthsElapsed: number,
  hasPriorYear: boolean,
): Confidence {
  if (monthsElapsed >= 9) return "high";
  if (hasPriorYear) return "high";
  if (monthsElapsed >= 4) return "medium";
  return "low";
}

// --- Helpers ---

function getMonthsElapsed(financialYear: number): number {
  const now = new Date();
  const fyStart = new Date(`${financialYear - 1}-07-01`);
  const fyEnd = new Date(`${financialYear}-06-30`);

  if (now < fyStart) return 0;
  if (now > fyEnd) return 12;

  // Months from July 1 to now
  const diffMs = now.getTime() - fyStart.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  return Math.min(12, Math.max(0, Math.floor(diffMonths)));
}

function groupTransactionsByMonth(
  txns: Array<{ date: string; amount: string; category: string; transactionType: string; propertyId: string | null }>,
  propertyId: string,
  category: string,
): MonthlyTotals {
  const totals: MonthlyTotals = {};
  for (const t of txns) {
    if (t.propertyId !== propertyId || t.category !== category) continue;
    const month = new Date(t.date).getMonth() + 1; // 1-indexed
    const amount = Math.abs(Number(t.amount));
    totals[month] = (totals[month] ?? 0) + amount;
  }
  return totals;
}

// --- Main service function ---

export async function buildTaxForecast(
  userId: string,
  financialYear: number,
): Promise<TaxForecastResult> {
  const monthsElapsed = getMonthsElapsed(financialYear);
  const priorYear = financialYear - 1;

  const { startDate, endDate } = getFinancialYearRange(financialYear);
  const { startDate: priorStart, endDate: priorEnd } = getFinancialYearRange(priorYear);

  // Fetch all data in parallel
  const [userProperties, currentTxns, priorTxns, taxProfile] = await Promise.all([
    db.query.properties.findMany({
      where: eq(properties.userId, userId),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, priorStart),
        lte(transactions.date, priorEnd),
      ),
    }),
    db.query.taxProfiles.findFirst({
      where: and(
        eq(taxProfiles.userId, userId),
        eq(taxProfiles.financialYear, financialYear),
      ),
    }),
  ]);

  const hasPriorYear = priorTxns.length > 0;
  const incomeCategories = categories.filter((c) => c.type === "income");
  const deductibleCategories = categories.filter((c) => c.isDeductible);
  const allRelevantCategories = [...incomeCategories, ...deductibleCategories];

  // Build per-property forecasts
  const propertyForecasts: PropertyForecast[] = userProperties.map((prop) => {
    const catForecasts: CategoryForecast[] = [];

    for (const cat of allRelevantCategories) {
      const currentMonths = groupTransactionsByMonth(
        currentTxns as any, prop.id, cat.value
      );
      const priorMonths = groupTransactionsByMonth(
        priorTxns as any, prop.id, cat.value
      );

      const { actual, forecast } = computeCategoryForecast(
        currentMonths, priorMonths, monthsElapsed
      );

      // Only include categories with data
      if (actual === 0 && forecast === 0) continue;

      catForecasts.push({
        category: cat.value,
        label: cat.label,
        atoCode: cat.atoReference ?? "",
        actual,
        forecast,
        confidence: computeConfidence(monthsElapsed, Object.keys(priorMonths).length > 0),
      });
    }

    const incomeActual = catForecasts
      .filter((c) => incomeCategories.some((ic) => ic.value === c.category))
      .reduce((s, c) => s + c.actual, 0);
    const incomeForecast = catForecasts
      .filter((c) => incomeCategories.some((ic) => ic.value === c.category))
      .reduce((s, c) => s + c.forecast, 0);
    const deductActual = catForecasts
      .filter((c) => deductibleCategories.some((dc) => dc.value === c.category))
      .reduce((s, c) => s + c.actual, 0);
    const deductForecast = catForecasts
      .filter((c) => deductibleCategories.some((dc) => dc.value === c.category))
      .reduce((s, c) => s + c.forecast, 0);

    return {
      propertyId: prop.id,
      address: prop.address,
      categories: catForecasts,
      totalIncome: { actual: incomeActual, forecast: incomeForecast },
      totalDeductions: { actual: deductActual, forecast: deductForecast },
      netResult: {
        actual: incomeActual - deductActual,
        forecast: incomeForecast - deductForecast,
      },
    };
  });

  // Portfolio totals
  const totalIncome = {
    actual: propertyForecasts.reduce((s, p) => s + p.totalIncome.actual, 0),
    forecast: propertyForecasts.reduce((s, p) => s + p.totalIncome.forecast, 0),
  };
  const totalDeductions = {
    actual: propertyForecasts.reduce((s, p) => s + p.totalDeductions.actual, 0),
    forecast: propertyForecasts.reduce((s, p) => s + p.totalDeductions.forecast, 0),
  };
  const netRentalResult = {
    actual: totalIncome.actual - totalDeductions.actual,
    forecast: totalIncome.forecast - totalDeductions.forecast,
  };

  // Calculate tax positions (actual and forecast) if profile exists
  let actualTaxPosition: TaxPositionResult | null = null;
  let forecastTaxPosition: TaxPositionResult | null = null;

  if (taxProfile?.isComplete) {
    const baseInput = {
      financialYear,
      grossSalary: Number(taxProfile.grossSalary ?? 0),
      paygWithheld: Number(taxProfile.paygWithheld ?? 0),
      otherDeductions: Number(taxProfile.otherDeductions ?? 0),
      hasHecsDebt: taxProfile.hasHecsDebt,
      hasPrivateHealth: taxProfile.hasPrivateHealth,
      familyStatus: taxProfile.familyStatus as "single" | "couple" | "family",
      dependentChildren: taxProfile.dependentChildren,
      partnerIncome: Number(taxProfile.partnerIncome ?? 0),
    };

    try {
      actualTaxPosition = calculateTaxPosition({
        ...baseInput,
        rentalNetResult: netRentalResult.actual,
      });
      forecastTaxPosition = calculateTaxPosition({
        ...baseInput,
        rentalNetResult: netRentalResult.forecast,
      });
    } catch {
      // Tax tables may not be available
    }
  }

  return {
    financialYear,
    monthsElapsed,
    properties: propertyForecasts,
    totalIncome,
    totalDeductions,
    netRentalResult,
    taxPosition: {
      actual: actualTaxPosition,
      forecast: forecastTaxPosition,
    },
    confidence: computeConfidence(monthsElapsed, hasPriorYear),
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/tax-forecast.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/server/services/tax-forecast.ts src/server/services/__tests__/tax-forecast.test.ts
git commit -m "feat(tax-forecast): add forecast service with hybrid algorithm"
```

---

### Task 2: Forecast tRPC Router

**Files:**
- Create: `src/server/routers/taxForecast.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

```typescript
// src/server/routers/taxForecast.ts

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildTaxForecast } from "../services/tax-forecast";

export const taxForecastRouter = router({
  getForecast: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().min(2020).max(2030),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildTaxForecast(ctx.portfolio.ownerId, input.financialYear);
    }),
});
```

**Step 2: Register the router in `_app.ts`**

Add import at line 44 (after mytax import):
```typescript
import { taxForecastRouter } from "./taxForecast";
```

Add to appRouter object at line 89 (after mytax):
```typescript
  taxForecast: taxForecastRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/taxForecast.ts src/server/routers/_app.ts
git commit -m "feat(tax-forecast): add tRPC router for forecast endpoint"
```

---

### Task 3: Forecast UI Components

**Files:**
- Create: `src/components/tax-position/ForecastAnnotation.tsx`
- Create: `src/components/tax-position/ForecastSummary.tsx`
- Create: `src/components/tax-position/ConfidenceBadge.tsx`

**Step 1: Create ConfidenceBadge**

```tsx
// src/components/tax-position/ConfidenceBadge.tsx

import { cn } from "@/lib/utils";

type Confidence = "high" | "medium" | "low";

const config: Record<Confidence, { label: string; className: string }> = {
  high: { label: "High", className: "bg-green-100 text-green-700" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-700" },
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { label, className } = config[confidence];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-green-500": confidence === "high",
        "bg-amber-500": confidence === "medium",
        "bg-gray-400": confidence === "low",
      })} />
      {label} confidence
    </span>
  );
}
```

**Step 2: Create ForecastAnnotation**

```tsx
// src/components/tax-position/ForecastAnnotation.tsx

"use client";

import { TrendingUp } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

interface ForecastAnnotationProps {
  actual: number;
  forecast: number;
}

export function ForecastAnnotation({ actual, forecast }: ForecastAnnotationProps) {
  // Don't show if forecast equals actual (category complete)
  if (forecast === actual) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-2">
      <TrendingUp className="h-3 w-3" />
      <span>&rarr; {formatCurrency(forecast)} projected</span>
    </span>
  );
}
```

**Step 3: Create ForecastSummary**

```tsx
// src/components/tax-position/ForecastSummary.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { TrendingUp } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

type Confidence = "high" | "medium" | "low";

interface ForecastSummaryProps {
  actualRefund: number;
  forecastRefund: number;
  actualIsRefund: boolean;
  forecastIsRefund: boolean;
  monthsElapsed: number;
  confidence: Confidence;
}

export function ForecastSummary({
  actualRefund,
  forecastRefund,
  actualIsRefund,
  forecastIsRefund,
  monthsElapsed,
  confidence,
}: ForecastSummaryProps) {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Full Year Projection
              </p>
              <p className="text-xs text-blue-700">
                {forecastIsRefund ? "Projected Refund" : "Projected Owing"}:{" "}
                <span className="font-semibold">
                  {formatCurrency(forecastRefund)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-sm ${
                        i < monthsElapsed ? "bg-blue-500" : "bg-blue-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="ml-1">{monthsElapsed}/12</span>
              </div>
            </div>
            <ConfidenceBadge confidence={confidence} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/tax-position/ForecastAnnotation.tsx src/components/tax-position/ForecastSummary.tsx src/components/tax-position/ConfidenceBadge.tsx
git commit -m "feat(tax-forecast): add forecast UI components"
```

---

### Task 4: Integrate Forecast Into Tax Position Page

**Files:**
- Modify: `src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx`

**Step 1: Add forecast query and summary**

At the top of `TaxPositionContent`, after the existing `rentalResult` query (~line 73), add the forecast query:

```typescript
const { data: forecast } = trpc.taxForecast.getForecast.useQuery(
  { financialYear: selectedYear! },
  { enabled: !!selectedYear }
);
```

Add imports at the top:
```typescript
import { ForecastSummary } from "@/components/tax-position/ForecastSummary";
import { ForecastAnnotation } from "@/components/tax-position/ForecastAnnotation";
```

**Step 2: Add ForecastSummary after the Summary Card**

After the Summary Card block (after line ~270, the closing `)}` of the calculation summary card), insert:

```tsx
{/* Forecast Summary */}
{forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && calculation && (
  <ForecastSummary
    actualRefund={calculation.refundOrOwing}
    forecastRefund={forecast.taxPosition.forecast.refundOrOwing}
    actualIsRefund={calculation.isRefund}
    forecastIsRefund={forecast.taxPosition.forecast.isRefund}
    monthsElapsed={forecast.monthsElapsed}
    confidence={forecast.confidence}
  />
)}
```

**Step 3: Add forecast annotations to the rental property result**

In the Deductions section, after the "Based on N transactions" paragraph (~line 377), add:

```tsx
{forecast && (
  <div className="text-xs text-muted-foreground">
    <ForecastAnnotation
      actual={Math.abs(rentalResult?.netResult ?? 0)}
      forecast={Math.abs(forecast.netRentalResult.forecast)}
    />
  </div>
)}
```

**Step 4: Add forecast annotations to the Tax Calculation breakdown**

In the Tax Calculation card, after each calculation row, add forecast annotations where they differ. Specifically, after the "Total tax liability" row (~line 452), add:

```tsx
{forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && (
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>Projected full year</span>
    <span>{formatCurrency(forecast.taxPosition.forecast.totalTaxLiability)}</span>
  </div>
)}
```

And after the final "ESTIMATED REFUND/OWING" row (~line 468), add:

```tsx
{forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && (
  <div className="flex justify-between text-xs text-muted-foreground pt-1">
    <span>Projected full year</span>
    <span className={
      forecast.taxPosition.forecast.isRefund ? "text-green-600" : "text-amber-600"
    }>
      {formatCurrency(Math.abs(forecast.taxPosition.forecast.refundOrOwing))}
      {" "}{forecast.taxPosition.forecast.isRefund ? "refund" : "owing"}
    </span>
  </div>
)}
```

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/tax-position/TaxPositionContent.tsx
git commit -m "feat(tax-forecast): integrate forecast into tax position page"
```

---

### Task 5: Add Forecast Line to Dashboard Card

**Files:**
- Modify: `src/components/tax-position/TaxPositionCard.tsx`

**Step 1: Add the forecast query**

After the existing `getSummary` query (~line 21), add:

```typescript
const { data: currentYear } = trpc.taxPosition.getCurrentYear.useQuery();
const { data: forecast } = trpc.taxForecast.getForecast.useQuery(
  { financialYear: currentYear! },
  { enabled: !!currentYear }
);
```

Add `TrendingUp` to the lucide imports:
```typescript
import { Calculator, Home, ArrowRight, Loader2, TrendingUp } from "lucide-react";
```

**Step 2: Add projected line in the complete state**

In the complete state section (~line 104), after the `propertySavings` paragraph and before the "View details" paragraph, add:

```tsx
{forecast?.taxPosition.forecast && forecast.monthsElapsed < 12 && (
  <p className="text-xs text-muted-foreground flex items-center gap-1">
    <TrendingUp className="h-3 w-3" />
    Projected: {formatCurrency(Math.abs(forecast.taxPosition.forecast.refundOrOwing))}{" "}
    {forecast.taxPosition.forecast.isRefund ? "refund" : "owing"} full year
  </p>
)}
```

**Step 3: Commit**

```bash
git add src/components/tax-position/TaxPositionCard.tsx
git commit -m "feat(tax-forecast): add projected line to dashboard card"
```

---

### Task 6: Type Check and Final Verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass including new forecast tests

**Step 3: Run lint**

Run: `npx next lint`
Expected: No errors

**Step 4: Fix any issues found in steps 1-3**

**Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix(tax-forecast): resolve type/lint issues"
```
