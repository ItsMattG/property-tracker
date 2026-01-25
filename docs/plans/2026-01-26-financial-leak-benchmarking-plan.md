# Financial Leak Benchmarking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add expense benchmarking to compare insurance, council rates, and management fees against state averages, showing potential savings.

**Architecture:** Static benchmark data, service calculates comparisons from existing transactions, UI shows property-level cards and dashboard widget.

**Tech Stack:** TypeScript, tRPC, React, Tailwind CSS, Vitest

---

### Task 1: Add Benchmark Data and Types

**Files:**
- Create: `src/types/benchmarking.ts`
- Create: `src/server/data/expense-benchmarks.ts`

**Step 1: Create types file**

Create `src/types/benchmarking.ts`:

```typescript
export type BenchmarkStatus = "below" | "average" | "above";

export interface CategoryBenchmark {
  userAmount: number;
  averageAmount: number;
  status: BenchmarkStatus;
  potentialSavings: number;
  percentDiff: number; // positive = above average, negative = below
}

export interface ManagementFeeBenchmark extends CategoryBenchmark {
  userPercent: number;
  averagePercent: number;
}

export interface PropertyBenchmark {
  propertyId: string;
  insurance: CategoryBenchmark | null;
  councilRates: CategoryBenchmark | null;
  managementFees: ManagementFeeBenchmark | null;
  totalPotentialSavings: number;
}

export interface PortfolioBenchmarkSummary {
  totalPotentialSavings: number;
  insuranceSavings: number;
  councilRatesSavings: number;
  managementFeesSavings: number;
  propertiesWithSavings: number;
  totalProperties: number;
}
```

**Step 2: Create benchmark data file**

Create `src/server/data/expense-benchmarks.ts`:

```typescript
// Insurance: Annual premium per $100k property value, by state
export const insuranceBenchmarks: Record<string, { low: number; average: number; high: number }> = {
  NSW: { low: 140, average: 180, high: 220 },
  VIC: { low: 130, average: 165, high: 200 },
  QLD: { low: 160, average: 200, high: 250 },
  SA: { low: 120, average: 155, high: 190 },
  WA: { low: 130, average: 170, high: 210 },
  TAS: { low: 110, average: 145, high: 180 },
  NT: { low: 180, average: 230, high: 290 },
  ACT: { low: 120, average: 155, high: 190 },
};

// Council Rates: Annual amount by state (median)
export const councilRatesBenchmarks: Record<string, { low: number; average: number; high: number }> = {
  NSW: { low: 1200, average: 1800, high: 2500 },
  VIC: { low: 1400, average: 2100, high: 2800 },
  QLD: { low: 1300, average: 1900, high: 2600 },
  SA: { low: 1100, average: 1600, high: 2200 },
  WA: { low: 1200, average: 1750, high: 2400 },
  TAS: { low: 1000, average: 1500, high: 2000 },
  NT: { low: 1300, average: 1850, high: 2500 },
  ACT: { low: 1500, average: 2200, high: 3000 },
};

// Property Management Fees (% of annual rent)
export const managementFeeBenchmarks = {
  low: 5.0,
  average: 7.0,
  high: 8.8,
};

// Threshold for "above average" status (15% above)
export const ABOVE_AVERAGE_THRESHOLD = 1.15;
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/benchmarking.ts src/server/data/expense-benchmarks.ts
git commit -m "feat: add benchmarking types and data"
```

---

### Task 2: Create Benchmarking Service

**Files:**
- Create: `src/server/services/benchmarking.ts`
- Create: `src/server/services/__tests__/benchmarking.test.ts`

**Step 1: Write the tests**

Create `src/server/services/__tests__/benchmarking.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateInsuranceBenchmark,
  calculateCouncilRatesBenchmark,
  calculateManagementFeesBenchmark,
  getBenchmarkStatus,
} from "../benchmarking";

describe("benchmarking service", () => {
  describe("getBenchmarkStatus", () => {
    it("returns 'below' when under average", () => {
      expect(getBenchmarkStatus(800, 1000)).toBe("below");
    });

    it("returns 'average' when within threshold", () => {
      expect(getBenchmarkStatus(1000, 1000)).toBe("average");
      expect(getBenchmarkStatus(1100, 1000)).toBe("average"); // 10% above, under 15% threshold
    });

    it("returns 'above' when over threshold", () => {
      expect(getBenchmarkStatus(1200, 1000)).toBe("above"); // 20% above
    });
  });

  describe("calculateInsuranceBenchmark", () => {
    it("calculates insurance benchmark based on property value", () => {
      const result = calculateInsuranceBenchmark(2500, 500000, "NSW");
      // Expected: 500000/100000 * 180 = $900
      expect(result.averageAmount).toBe(900);
      expect(result.userAmount).toBe(2500);
      expect(result.status).toBe("above");
      expect(result.potentialSavings).toBe(1600);
    });

    it("returns null for zero user amount", () => {
      const result = calculateInsuranceBenchmark(0, 500000, "NSW");
      expect(result).toBeNull();
    });
  });

  describe("calculateCouncilRatesBenchmark", () => {
    it("calculates council rates benchmark", () => {
      const result = calculateCouncilRatesBenchmark(2500, "VIC");
      // VIC average: 2100
      expect(result.averageAmount).toBe(2100);
      expect(result.status).toBe("above"); // 2500 > 2100 * 1.15
    });

    it("returns average status when within threshold", () => {
      const result = calculateCouncilRatesBenchmark(2000, "VIC");
      expect(result.status).toBe("average");
    });
  });

  describe("calculateManagementFeesBenchmark", () => {
    it("calculates management fees as percentage of rent", () => {
      const result = calculateManagementFeesBenchmark(3600, 40000); // 9% of rent
      expect(result.userPercent).toBe(9);
      expect(result.averagePercent).toBe(7);
      expect(result.status).toBe("above");
      expect(result.potentialSavings).toBe(800); // 3600 - (40000 * 0.07)
    });

    it("returns null when no rental income", () => {
      const result = calculateManagementFeesBenchmark(3600, 0);
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/benchmarking.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement the service**

Create `src/server/services/benchmarking.ts`:

```typescript
import type {
  BenchmarkStatus,
  CategoryBenchmark,
  ManagementFeeBenchmark,
} from "@/types/benchmarking";
import {
  insuranceBenchmarks,
  councilRatesBenchmarks,
  managementFeeBenchmarks,
  ABOVE_AVERAGE_THRESHOLD,
} from "../data/expense-benchmarks";

export function getBenchmarkStatus(
  userAmount: number,
  averageAmount: number
): BenchmarkStatus {
  if (userAmount > averageAmount * ABOVE_AVERAGE_THRESHOLD) {
    return "above";
  }
  if (userAmount < averageAmount * (2 - ABOVE_AVERAGE_THRESHOLD)) {
    return "below";
  }
  return "average";
}

export function calculateInsuranceBenchmark(
  userAnnualInsurance: number,
  propertyValue: number,
  state: string
): CategoryBenchmark | null {
  if (userAnnualInsurance <= 0 || propertyValue <= 0) {
    return null;
  }

  const benchmark = insuranceBenchmarks[state] || insuranceBenchmarks.NSW;
  const averageAmount = (propertyValue / 100000) * benchmark.average;
  const status = getBenchmarkStatus(userAnnualInsurance, averageAmount);
  const potentialSavings = Math.max(0, Math.round(userAnnualInsurance - averageAmount));
  const percentDiff = Math.round(((userAnnualInsurance - averageAmount) / averageAmount) * 100);

  return {
    userAmount: userAnnualInsurance,
    averageAmount: Math.round(averageAmount),
    status,
    potentialSavings,
    percentDiff,
  };
}

export function calculateCouncilRatesBenchmark(
  userAnnualRates: number,
  state: string
): CategoryBenchmark | null {
  if (userAnnualRates <= 0) {
    return null;
  }

  const benchmark = councilRatesBenchmarks[state] || councilRatesBenchmarks.NSW;
  const averageAmount = benchmark.average;
  const status = getBenchmarkStatus(userAnnualRates, averageAmount);
  const potentialSavings = Math.max(0, Math.round(userAnnualRates - averageAmount));
  const percentDiff = Math.round(((userAnnualRates - averageAmount) / averageAmount) * 100);

  return {
    userAmount: userAnnualRates,
    averageAmount,
    status,
    potentialSavings,
    percentDiff,
  };
}

export function calculateManagementFeesBenchmark(
  userAnnualFees: number,
  annualRent: number
): ManagementFeeBenchmark | null {
  if (userAnnualFees <= 0 || annualRent <= 0) {
    return null;
  }

  const userPercent = (userAnnualFees / annualRent) * 100;
  const averagePercent = managementFeeBenchmarks.average;
  const averageAmount = annualRent * (averagePercent / 100);
  const status = userPercent > managementFeeBenchmarks.high ? "above" :
                 userPercent < managementFeeBenchmarks.low ? "below" : "average";
  const potentialSavings = Math.max(0, Math.round(userAnnualFees - averageAmount));
  const percentDiff = Math.round(((userAnnualFees - averageAmount) / averageAmount) * 100);

  return {
    userAmount: userAnnualFees,
    averageAmount: Math.round(averageAmount),
    status,
    potentialSavings,
    percentDiff,
    userPercent: Math.round(userPercent * 10) / 10,
    averagePercent,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/benchmarking.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/benchmarking.ts src/server/services/__tests__/benchmarking.test.ts
git commit -m "feat: add benchmarking service with tests"
```

---

### Task 3: Create Benchmarking Router

**Files:**
- Create: `src/server/routers/benchmarking.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/benchmarking.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { properties, transactions } from "../db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import {
  calculateInsuranceBenchmark,
  calculateCouncilRatesBenchmark,
  calculateManagementFeesBenchmark,
} from "../services/benchmarking";
import type { PropertyBenchmark, PortfolioBenchmarkSummary } from "@/types/benchmarking";

// Get transactions for last 12 months
function getLastYearDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date;
}

export const benchmarkingRouter = router({
  getPropertyBenchmark: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<PropertyBenchmark | null> => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
        with: {
          valuations: {
            orderBy: (v, { desc }) => [desc(v.valuationDate)],
            limit: 1,
          },
        },
      });

      if (!property) return null;

      const lastYear = getLastYearDate();
      const propertyTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, input.propertyId),
          gte(transactions.date, lastYear.toISOString().split("T")[0])
        ),
      });

      // Sum by category
      const sumByCategory = (category: string) =>
        propertyTransactions
          .filter((t) => t.category === category)
          .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const insuranceTotal = sumByCategory("insurance");
      const councilRatesTotal = sumByCategory("council_rates");
      const managementFeesTotal = sumByCategory("property_agent_fees");
      const rentalIncomeTotal = sumByCategory("rental_income");

      const propertyValue = property.valuations?.[0]?.estimatedValue
        ? parseFloat(property.valuations[0].estimatedValue)
        : parseFloat(property.purchasePrice);

      const insurance = calculateInsuranceBenchmark(insuranceTotal, propertyValue, property.state);
      const councilRates = calculateCouncilRatesBenchmark(councilRatesTotal, property.state);
      const managementFees = calculateManagementFeesBenchmark(managementFeesTotal, rentalIncomeTotal);

      const totalPotentialSavings =
        (insurance?.potentialSavings || 0) +
        (councilRates?.potentialSavings || 0) +
        (managementFees?.potentialSavings || 0);

      return {
        propertyId: input.propertyId,
        insurance,
        councilRates,
        managementFees,
        totalPotentialSavings,
      };
    }),

  getPortfolioSummary: protectedProcedure.query(
    async ({ ctx }): Promise<PortfolioBenchmarkSummary> => {
      const userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
        with: {
          valuations: {
            orderBy: (v, { desc }) => [desc(v.valuationDate)],
            limit: 1,
          },
        },
      });

      if (userProperties.length === 0) {
        return {
          totalPotentialSavings: 0,
          insuranceSavings: 0,
          councilRatesSavings: 0,
          managementFeesSavings: 0,
          propertiesWithSavings: 0,
          totalProperties: 0,
        };
      }

      const lastYear = getLastYearDate();
      const propertyIds = userProperties.map((p) => p.id);

      const allTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          inArray(transactions.propertyId, propertyIds),
          gte(transactions.date, lastYear.toISOString().split("T")[0])
        ),
      });

      let insuranceSavings = 0;
      let councilRatesSavings = 0;
      let managementFeesSavings = 0;
      let propertiesWithSavings = 0;

      for (const property of userProperties) {
        const propertyTxns = allTransactions.filter((t) => t.propertyId === property.id);

        const sumByCategory = (category: string) =>
          propertyTxns
            .filter((t) => t.category === category)
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

        const insuranceTotal = sumByCategory("insurance");
        const councilRatesTotal = sumByCategory("council_rates");
        const managementFeesTotal = sumByCategory("property_agent_fees");
        const rentalIncomeTotal = sumByCategory("rental_income");

        const propertyValue = property.valuations?.[0]?.estimatedValue
          ? parseFloat(property.valuations[0].estimatedValue)
          : parseFloat(property.purchasePrice);

        const insurance = calculateInsuranceBenchmark(insuranceTotal, propertyValue, property.state);
        const councilRates = calculateCouncilRatesBenchmark(councilRatesTotal, property.state);
        const managementFees = calculateManagementFeesBenchmark(managementFeesTotal, rentalIncomeTotal);

        const propertySavings =
          (insurance?.potentialSavings || 0) +
          (councilRates?.potentialSavings || 0) +
          (managementFees?.potentialSavings || 0);

        if (propertySavings > 0) {
          propertiesWithSavings++;
        }

        insuranceSavings += insurance?.potentialSavings || 0;
        councilRatesSavings += councilRates?.potentialSavings || 0;
        managementFeesSavings += managementFees?.potentialSavings || 0;
      }

      return {
        totalPotentialSavings: insuranceSavings + councilRatesSavings + managementFeesSavings,
        insuranceSavings,
        councilRatesSavings,
        managementFeesSavings,
        propertiesWithSavings,
        totalProperties: userProperties.length,
      };
    }
  ),
});
```

**Step 2: Register router in app**

In `src/server/routers/_app.ts`, add:

```typescript
import { benchmarkingRouter } from "./benchmarking";

// In the router definition:
benchmarking: benchmarkingRouter,
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/benchmarking.ts src/server/routers/_app.ts
git commit -m "feat: add benchmarking router"
```

---

### Task 4: Create BenchmarkCard Component

**Files:**
- Create: `src/components/benchmarking/BenchmarkCard.tsx`
- Create: `src/components/benchmarking/index.ts`

**Step 1: Create the card component**

Create `src/components/benchmarking/BenchmarkCard.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PiggyBank, Check, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { BenchmarkStatus, CategoryBenchmark, ManagementFeeBenchmark } from "@/types/benchmarking";
import { cn } from "@/lib/utils";

interface BenchmarkCardProps {
  propertyId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusIcon({ status }: { status: BenchmarkStatus }) {
  if (status === "above") {
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
  return <Check className="h-4 w-4 text-green-500" />;
}

function StatusLabel({ status }: { status: BenchmarkStatus }) {
  const labels: Record<BenchmarkStatus, { text: string; className: string }> = {
    below: { text: "Below Average", className: "text-green-600" },
    average: { text: "Average", className: "text-muted-foreground" },
    above: { text: "Above Average", className: "text-amber-600" },
  };
  const { text, className } = labels[status];
  return <span className={cn("text-sm font-medium", className)}>{text}</span>;
}

function BenchmarkRow({
  label,
  benchmark,
  showPercent,
}: {
  label: string;
  benchmark: CategoryBenchmark | ManagementFeeBenchmark | null;
  showPercent?: boolean;
}) {
  if (!benchmark) return null;

  const isManagement = showPercent && "userPercent" in benchmark;

  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <StatusIcon status={benchmark.status} />
        </div>
        <div className="text-sm text-muted-foreground">
          {isManagement ? (
            <>
              Your rate: {(benchmark as ManagementFeeBenchmark).userPercent}% · Avg: {(benchmark as ManagementFeeBenchmark).averagePercent}%
            </>
          ) : (
            <>
              {formatCurrency(benchmark.userAmount)}/yr · Avg: {formatCurrency(benchmark.averageAmount)}
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <StatusLabel status={benchmark.status} />
        {benchmark.potentialSavings > 0 && (
          <p className="text-sm text-amber-600">Save ~{formatCurrency(benchmark.potentialSavings)}</p>
        )}
      </div>
    </div>
  );
}

export function BenchmarkCard({ propertyId }: BenchmarkCardProps) {
  const { data: benchmark, isLoading } = trpc.benchmarking.getPropertyBenchmark.useQuery({
    propertyId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Don't show card if no benchmark data
  if (!benchmark || (!benchmark.insurance && !benchmark.councilRates && !benchmark.managementFees)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <PiggyBank className="w-5 h-5 text-emerald-500" />
          </div>
          <CardTitle>Cost Benchmarking</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          <BenchmarkRow label="Insurance" benchmark={benchmark.insurance} />
          <BenchmarkRow label="Council Rates" benchmark={benchmark.councilRates} />
          <BenchmarkRow label="Management Fees" benchmark={benchmark.managementFees} showPercent />
        </div>

        {benchmark.totalPotentialSavings > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Potential Savings</span>
              <span className="text-lg font-bold text-emerald-600">
                {formatCurrency(benchmark.totalPotentialSavings)}/year
              </span>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Compared against state averages from industry data. Based on last 12 months of transactions.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create index export**

Create `src/components/benchmarking/index.ts`:

```typescript
export { BenchmarkCard } from "./BenchmarkCard";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/benchmarking/
git commit -m "feat: add BenchmarkCard component"
```

---

### Task 5: Create SavingsWidget Component

**Files:**
- Create: `src/components/benchmarking/SavingsWidget.tsx`
- Modify: `src/components/benchmarking/index.ts`

**Step 1: Create the widget component**

Create `src/components/benchmarking/SavingsWidget.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PiggyBank } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SavingsWidget() {
  const { data: summary, isLoading } = trpc.benchmarking.getPortfolioSummary.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Don't show widget if no savings or less than $100
  if (!summary || summary.totalPotentialSavings < 100) {
    return null;
  }

  const savingsBreakdown = [
    summary.insuranceSavings > 0 && `Insurance: ${formatCurrency(summary.insuranceSavings)}`,
    summary.councilRatesSavings > 0 && `Rates: ${formatCurrency(summary.councilRatesSavings)}`,
    summary.managementFeesSavings > 0 && `Mgmt: ${formatCurrency(summary.managementFeesSavings)}`,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <PiggyBank className="w-4 h-4 text-emerald-500" />
          </div>
          <CardTitle className="text-base">Potential Savings</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-emerald-600">
          {formatCurrency(summary.totalPotentialSavings)}/year
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          across {summary.propertiesWithSavings} of {summary.totalProperties} properties
        </p>
        {savingsBreakdown.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {savingsBreakdown.join(" · ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update index export**

Update `src/components/benchmarking/index.ts`:

```typescript
export { BenchmarkCard } from "./BenchmarkCard";
export { SavingsWidget } from "./SavingsWidget";
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/benchmarking/
git commit -m "feat: add SavingsWidget component"
```

---

### Task 6: Add BenchmarkCard to Property Detail Page

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx`

**Step 1: Import BenchmarkCard**

Add at top of file:

```typescript
import { BenchmarkCard } from "@/components/benchmarking";
```

**Step 2: Add BenchmarkCard to the page**

Find the grid layout where cards are rendered (near ClimateRiskCard). Add:

```typescript
<BenchmarkCard propertyId={propertyId} />
```

Place it after the ClimateRiskCard.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/page.tsx
git commit -m "feat: add benchmark card to property detail page"
```

---

### Task 7: Add SavingsWidget to Dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Import SavingsWidget**

Add at top of file:

```typescript
import { SavingsWidget } from "@/components/benchmarking";
```

**Step 2: Add SavingsWidget to dashboard**

Find where other widgets are rendered (near ClimateRiskSummary). Add:

```typescript
<SavingsWidget />
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add savings widget to dashboard"
```

---

### Task 8: Final Verification

**Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors

**Step 4: Commit any fixes**

If any fixes needed:
```bash
git add -A
git commit -m "fix: address lint/type issues"
```
