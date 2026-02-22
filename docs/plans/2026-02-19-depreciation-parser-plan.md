# Depreciation Schedule Parser Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close three gaps in the existing depreciation feature: ATO-compliant calculation service, tax position integration, and multi-year depreciation tracking.

**Architecture:** Server-side calculation service as source of truth (pure functions, no DB). Lightweight client-side preview for instant feedback during edits. Tax position router queries depreciation schedules and subtracts from rental result. Multi-year projections calculated on-the-fly.

**Tech Stack:** TypeScript · Vitest · tRPC v11 · Drizzle ORM · Recharts · shadcn/ui

**Design doc:** `docs/plans/2026-02-19-depreciation-parser-design.md`

## Tech Notes

- **DB columns are `decimal` strings** — `originalCost`, `effectiveLife`, `yearlyDeduction`, `remainingValue` are all `decimal(12,2)` or `decimal(5,2)` in Postgres, which Drizzle returns as `string`. Must `parseFloat()` before calculation.
- **`depreciationSchedules.effectiveDate`** is a `date` column (string in format `YYYY-MM-DD`).
- **Financial year** is represented as an integer (e.g., `2026` = FY 2025-26, Jul 1 2025 to Jun 30 2026). `getFinancialYearRange(year)` returns `{ startDate, endDate }`.
- **Tax repo interface** (`ITaxRepository`): `findSchedules(userId, propertyId?)` returns `DepreciationScheduleWithRelations[]` which includes `.assets: DepreciationAsset[]`.
- **Existing `calculateRemainingValue`** in `depreciation-extract.ts` — will be moved to the new calc service and deleted from extract.
- **`formatCurrency`** from `@/lib/utils` returns AUD format like `"$1,000"`.
- **Chart colors**: `var(--color-chart-1)` through `var(--color-chart-5)` in `globals.css`.

---

### Task 1: ATO Depreciation Calculation Service (Server)

**Files:**
- Create: `src/server/services/tax/depreciation-calc.ts`
- Create: `src/server/services/tax/__tests__/depreciation-calc.test.ts`

Pure functions implementing ATO depreciation formulas. No DB, no side effects.

**Step 1: Write failing tests**

```typescript
// src/server/services/tax/__tests__/depreciation-calc.test.ts
import { describe, it, expect } from "vitest";
import {
  calculateYearlyDeduction,
  calculateRemainingValue,
  generateMultiYearSchedule,
  validateAndRecalculate,
} from "../depreciation-calc";

describe("calculateYearlyDeduction", () => {
  it("calculates prime cost correctly", () => {
    // $10,000 asset, 10 year life = $1,000/year
    expect(calculateYearlyDeduction(10000, 10, "prime_cost")).toBe(1000);
  });

  it("calculates diminishing value correctly", () => {
    // $10,000 asset, 10 year life = (10000 * 2) / 10 = $2,000 first year
    expect(calculateYearlyDeduction(10000, 10, "diminishing_value")).toBe(2000);
  });

  it("handles capital works 40-year at 2.5%", () => {
    // $400,000 building, 40 year life = $10,000/year (prime cost)
    expect(calculateYearlyDeduction(400000, 40, "prime_cost")).toBe(10000);
  });

  it("returns 0 for zero cost", () => {
    expect(calculateYearlyDeduction(0, 10, "prime_cost")).toBe(0);
  });

  it("returns 0 for zero effective life", () => {
    expect(calculateYearlyDeduction(10000, 0, "prime_cost")).toBe(0);
  });

  it("prorates first year by days held", () => {
    // $10,000 asset, 10yr prime cost = $1,000/yr
    // Held 182.5 days out of 365 = $500
    expect(calculateYearlyDeduction(10000, 10, "prime_cost", 182.5 / 365)).toBe(500);
  });
});

describe("calculateRemainingValue", () => {
  it("calculates prime cost remaining after 3 years", () => {
    // $10,000, 10yr PC = $1,000/yr deduction, after 3 years = $7,000
    expect(calculateRemainingValue(10000, 10, "prime_cost", 3)).toBe(7000);
  });

  it("calculates diminishing value remaining after 3 years", () => {
    // $10,000, 10yr DV: rate = 0.2
    // Year 1: 10000 * 0.2 = 2000 → 8000
    // Year 2: 8000 * 0.2 = 1600 → 6400
    // Year 3: 6400 * 0.2 = 1280 → 5120
    expect(calculateRemainingValue(10000, 10, "diminishing_value", 3)).toBe(5120);
  });

  it("never goes below zero", () => {
    expect(calculateRemainingValue(10000, 10, "prime_cost", 15)).toBe(0);
  });

  it("returns original cost for 0 years elapsed", () => {
    expect(calculateRemainingValue(10000, 10, "prime_cost", 0)).toBe(10000);
  });
});

describe("generateMultiYearSchedule", () => {
  it("generates prime cost schedule", () => {
    const schedule = generateMultiYearSchedule(10000, 5, "prime_cost");
    expect(schedule).toHaveLength(5);
    expect(schedule[0]).toEqual({
      year: 1,
      openingValue: 10000,
      deduction: 2000,
      closingValue: 8000,
    });
    expect(schedule[4]).toEqual({
      year: 5,
      openingValue: 2000,
      deduction: 2000,
      closingValue: 0,
    });
  });

  it("generates diminishing value schedule", () => {
    const schedule = generateMultiYearSchedule(10000, 10, "diminishing_value");
    // Year 1: opening 10000, deduction 2000, closing 8000
    expect(schedule[0]).toEqual({
      year: 1,
      openingValue: 10000,
      deduction: 2000,
      closingValue: 8000,
    });
    // Year 2: opening 8000, deduction 1600, closing 6400
    expect(schedule[1]).toEqual({
      year: 2,
      openingValue: 8000,
      deduction: 1600,
      closingValue: 6400,
    });
  });

  it("caps years parameter", () => {
    const schedule = generateMultiYearSchedule(10000, 50, "prime_cost", 5);
    expect(schedule).toHaveLength(5);
  });

  it("stops when value reaches zero", () => {
    const schedule = generateMultiYearSchedule(10000, 5, "prime_cost");
    expect(schedule).toHaveLength(5);
    expect(schedule[schedule.length - 1].closingValue).toBe(0);
  });
});

describe("validateAndRecalculate", () => {
  it("recalculates yearly deduction from ATO formula", () => {
    const assets = [
      {
        assetName: "Carpet",
        category: "plant_equipment" as const,
        originalCost: 5000,
        effectiveLife: 10,
        method: "diminishing_value" as const,
        yearlyDeduction: 800, // AI's wrong answer
      },
    ];
    const result = validateAndRecalculate(assets);
    expect(result[0].yearlyDeduction).toBe(1000); // correct: (5000*2)/10
    expect(result[0].discrepancy).toBe(true); // >10% difference
  });

  it("flags no discrepancy when AI is close enough", () => {
    const assets = [
      {
        assetName: "Blinds",
        category: "plant_equipment" as const,
        originalCost: 3000,
        effectiveLife: 10,
        method: "prime_cost" as const,
        yearlyDeduction: 295, // close to 300
      },
    ];
    const result = validateAndRecalculate(assets);
    expect(result[0].yearlyDeduction).toBe(300);
    expect(result[0].discrepancy).toBe(false);
  });

  it("defaults capital_works to prime_cost 40yr if method is diminishing_value", () => {
    const assets = [
      {
        assetName: "Building Structure",
        category: "capital_works" as const,
        originalCost: 400000,
        effectiveLife: 20, // wrong life
        method: "diminishing_value" as const, // wrong method
        yearlyDeduction: 40000, // wrong deduction
      },
    ];
    const result = validateAndRecalculate(assets);
    // Capital works: prime_cost, 40yr → 400000/40 = 10000
    expect(result[0].method).toBe("prime_cost");
    expect(result[0].effectiveLife).toBe(40);
    expect(result[0].yearlyDeduction).toBe(10000);
    expect(result[0].discrepancy).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx vitest run src/server/services/tax/__tests__/depreciation-calc.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the calculation service**

```typescript
// src/server/services/tax/depreciation-calc.ts

type DepreciationMethod = "diminishing_value" | "prime_cost";
type DepreciationCategory = "plant_equipment" | "capital_works";

export interface YearEntry {
  year: number;
  openingValue: number;
  deduction: number;
  closingValue: number;
}

export interface ExtractedAssetInput {
  assetName: string;
  category: DepreciationCategory;
  originalCost: number;
  effectiveLife: number;
  method: DepreciationMethod;
  yearlyDeduction: number;
}

export interface ValidatedAsset extends ExtractedAssetInput {
  discrepancy: boolean;
}

/**
 * Calculate yearly depreciation deduction per ATO rules.
 * - Prime Cost: originalCost / effectiveLife
 * - Diminishing Value: (originalCost × 2) / effectiveLife (200% rate)
 * @param proRataFactor - fraction of year held (0-1), defaults to 1 (full year)
 */
export function calculateYearlyDeduction(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod,
  proRataFactor: number = 1
): number {
  if (originalCost <= 0 || effectiveLife <= 0) return 0;

  let deduction: number;
  if (method === "prime_cost") {
    deduction = originalCost / effectiveLife;
  } else {
    // Diminishing value: 200% rate applied to original cost (first year)
    deduction = (originalCost * 2) / effectiveLife;
  }

  return Math.round(deduction * proRataFactor * 100) / 100;
}

/**
 * Calculate remaining value after N years of depreciation.
 * Prime Cost: linear reduction.
 * Diminishing Value: iterative — apply rate each year to remaining balance.
 */
export function calculateRemainingValue(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod,
  yearsElapsed: number
): number {
  if (originalCost <= 0 || effectiveLife <= 0) return 0;
  if (yearsElapsed <= 0) return originalCost;

  if (method === "prime_cost") {
    const annualDeduction = originalCost / effectiveLife;
    return Math.max(0, Math.round((originalCost - annualDeduction * yearsElapsed) * 100) / 100);
  }

  // Diminishing value: rate = 2 / effective life
  const rate = 2 / effectiveLife;
  let value = originalCost;
  for (let i = 0; i < yearsElapsed; i++) {
    value = value * (1 - rate);
    if (value < 0.01) return 0;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Generate a year-by-year depreciation schedule.
 * Stops when closing value reaches 0 or max years reached.
 */
export function generateMultiYearSchedule(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod,
  maxYears?: number
): YearEntry[] {
  if (originalCost <= 0 || effectiveLife <= 0) return [];

  const years = Math.min(maxYears ?? effectiveLife, 40);
  const entries: YearEntry[] = [];
  let openingValue = originalCost;

  for (let year = 1; year <= years; year++) {
    if (openingValue <= 0) break;

    let deduction: number;
    if (method === "prime_cost") {
      deduction = originalCost / effectiveLife;
    } else {
      deduction = openingValue * (2 / effectiveLife);
    }

    // Cap deduction to remaining value
    deduction = Math.min(deduction, openingValue);
    deduction = Math.round(deduction * 100) / 100;

    const closingValue = Math.max(0, Math.round((openingValue - deduction) * 100) / 100);

    entries.push({
      year,
      openingValue: Math.round(openingValue * 100) / 100,
      deduction,
      closingValue,
    });

    openingValue = closingValue;
  }

  return entries;
}

/**
 * Validate AI-extracted assets and recalculate deductions using ATO formulas.
 * - Replaces AI deductions with calculated ones
 * - Flags discrepancies > 10%
 * - Enforces capital_works = prime_cost, 40yr
 */
export function validateAndRecalculate(
  assets: ExtractedAssetInput[]
): ValidatedAsset[] {
  return assets.map((asset) => {
    let { method, effectiveLife } = asset;

    // Capital works guardrail: must be prime cost, 40 years
    if (asset.category === "capital_works") {
      method = "prime_cost";
      effectiveLife = 40;
    }

    const calculated = calculateYearlyDeduction(
      asset.originalCost,
      effectiveLife,
      method
    );

    // Flag discrepancy if AI value differs > 10%
    const aiDeduction = asset.yearlyDeduction;
    const diff = Math.abs(calculated - aiDeduction);
    const threshold = calculated * 0.1;
    const discrepancy = diff > threshold;

    return {
      ...asset,
      method,
      effectiveLife,
      yearlyDeduction: calculated,
      discrepancy,
    };
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx vitest run src/server/services/tax/__tests__/depreciation-calc.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/services/tax/depreciation-calc.ts src/server/services/tax/__tests__/depreciation-calc.test.ts
git commit -m "feat: add ATO depreciation calculation service with tests"
```

---

### Task 2: Client-Side Preview Utility

**Files:**
- Create: `src/lib/depreciation.ts`
- Create: `src/lib/__tests__/depreciation.test.ts`

Lightweight client-side copy of `calculateYearlyDeduction` for instant preview during edits.

**Step 1: Write failing tests**

```typescript
// src/lib/__tests__/depreciation.test.ts
import { describe, it, expect } from "vitest";
import { calculateYearlyDeduction } from "../depreciation";

describe("client calculateYearlyDeduction", () => {
  it("calculates prime cost", () => {
    expect(calculateYearlyDeduction(10000, 10, "prime_cost")).toBe(1000);
  });

  it("calculates diminishing value", () => {
    expect(calculateYearlyDeduction(10000, 10, "diminishing_value")).toBe(2000);
  });

  it("returns 0 for invalid inputs", () => {
    expect(calculateYearlyDeduction(0, 10, "prime_cost")).toBe(0);
    expect(calculateYearlyDeduction(10000, 0, "prime_cost")).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx vitest run src/lib/__tests__/depreciation.test.ts`
Expected: FAIL — module not found

**Step 3: Implement client utility**

```typescript
// src/lib/depreciation.ts

type DepreciationMethod = "diminishing_value" | "prime_cost";

/**
 * Client-side depreciation preview calculation.
 * Used for instant UI feedback when editing asset fields.
 * Server recalculates authoritatively on save.
 */
export function calculateYearlyDeduction(
  originalCost: number,
  effectiveLife: number,
  method: DepreciationMethod
): number {
  if (originalCost <= 0 || effectiveLife <= 0) return 0;

  if (method === "prime_cost") {
    return Math.round((originalCost / effectiveLife) * 100) / 100;
  }

  // Diminishing value: 200% rate
  return Math.round(((originalCost * 2) / effectiveLife) * 100) / 100;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx vitest run src/lib/__tests__/depreciation.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/depreciation.ts src/lib/__tests__/depreciation.test.ts
git commit -m "feat: add client-side depreciation preview utility"
```

---

### Task 3: Wire Validation Into Extraction Pipeline

**Files:**
- Modify: `src/server/services/property-analysis/depreciation-extract.ts`
- Modify: `src/server/routers/tax/taxOptimization.ts`

Add `validateAndRecalculate()` call after AI extraction. Remove orphaned `calculateRemainingValue` from extract service.

**Step 1: Update extraction router to validate after extraction**

In `src/server/routers/tax/taxOptimization.ts`, modify the `extractDepreciation` mutation (around line 93-107).

Currently it returns raw AI results:
```typescript
return {
  assets: result.assets,
  totalValue: result.totalValue,
  effectiveDate: result.effectiveDate,
};
```

Change to validate and recalculate:
```typescript
import { validateAndRecalculate } from "../../services/tax/depreciation-calc";

// ... inside extractDepreciation mutation, after line 94:

const validatedAssets = validateAndRecalculate(result.assets);
const totalValue = validatedAssets.reduce((sum, a) => sum + a.originalCost, 0);

return {
  assets: validatedAssets,
  totalValue,
  effectiveDate: result.effectiveDate,
};
```

**Step 2: Remove orphaned `calculateRemainingValue` from extract service**

In `src/server/services/property-analysis/depreciation-extract.ts`, delete lines 162-184 (the `calculateRemainingValue` function). This logic now lives in `depreciation-calc.ts`.

**Step 3: Update the barrel export if needed**

Check `src/server/services/tax/index.ts` — add export for the new calc service if a barrel exists:

```typescript
export * from "./depreciation-calc";
```

If no barrel exists, skip this step (the router imports directly).

**Step 4: Verify TypeScript compiles**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx tsc --noEmit --pretty 2>&1 | grep -E "depreciation|taxOptimization" | head -20`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/server/routers/tax/taxOptimization.ts src/server/services/property-analysis/depreciation-extract.ts
git commit -m "feat: validate AI-extracted depreciation with ATO formulas"
```

---

### Task 4: Tax Position Integration

**Files:**
- Modify: `src/server/services/tax/position.ts` (add `depreciationDeductions` to input/output)
- Modify: `src/server/routers/tax/taxPosition.ts` (query depreciation in `getRentalResult` and `getSummary`)
- Modify: `src/server/services/tax/__tests__/depreciation-calc.test.ts` or create new test file for position changes

**Step 1: Add `depreciationDeductions` to `TaxPositionInput` and `TaxPositionResult`**

In `src/server/services/tax/position.ts`:

Add to `TaxPositionInput` (after line 13):
```typescript
depreciationDeductions: number; // total yearly depreciation from uploaded schedules
```

Add to `TaxPositionResult` (after `otherDeductions` line 30):
```typescript
depreciationDeductions: number;
```

**Step 2: Update `calculateTaxPosition` to include depreciation**

In the `calculateTaxPosition` function (line 168+):

Change the taxable income calculation (lines 177-181):
```typescript
// Depreciation reduces rental income (or increases rental loss)
const adjustedRentalResult = input.rentalNetResult - input.depreciationDeductions;
const taxableIncome = Math.max(
  0,
  input.grossSalary + adjustedRentalResult - input.otherDeductions
);
```

Update `propertySavings` calculation (lines 208-210) to include depreciation:
```typescript
const totalPropertyLoss = adjustedRentalResult < 0 ? Math.abs(adjustedRentalResult) : 0;
const propertySavings = totalPropertyLoss * marginalRate;
```

Update `totalDeductions` (lines 213-214):
```typescript
const rentalDeduction = adjustedRentalResult < 0 ? Math.abs(adjustedRentalResult) : 0;
const totalDeductions = rentalDeduction + input.otherDeductions;
```

Add `depreciationDeductions` to the return object:
```typescript
depreciationDeductions: input.depreciationDeductions,
```

**Step 3: Update callers to pass `depreciationDeductions`**

In `src/server/routers/tax/taxPosition.ts`:

Add import for depreciation schedule querying:
```typescript
import { depreciationSchedules, depreciationAssets } from "../../db/schema";
```

Add a helper function at the top of the file (before the router):
```typescript
async function getDepreciationTotal(
  db: typeof import("../../db").db,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Cross-domain: queries depreciation tables for financial year total
  const schedules = await db.query.depreciationSchedules.findMany({
    where: and(
      eq(depreciationSchedules.userId, userId),
      gte(depreciationSchedules.effectiveDate, startDate.toISOString().split("T")[0]),
      lte(depreciationSchedules.effectiveDate, endDate.toISOString().split("T")[0])
    ),
    with: { assets: true },
  });

  return schedules.reduce((total, schedule) => {
    const scheduleTotal = schedule.assets.reduce(
      (sum, asset) => sum + parseFloat(asset.yearlyDeduction),
      0
    );
    return total + scheduleTotal;
  }, 0);
}
```

Update `getRentalResult` (line 101-129) to also return depreciation:
```typescript
getRentalResult: protectedProcedure
  .input(z.object({ financialYear: z.number().int() }))
  .query(async ({ ctx, input }) => {
    const { startDate, endDate } = getFinancialYearRange(input.financialYear);

    // Cross-domain: queries transactions table for financial year rental metrics
    const txns = await ctx.db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, ctx.portfolio.ownerId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      ),
    });

    const metrics = calculatePropertyMetrics(
      txns.map((t) => ({
        category: t.category,
        amount: t.amount,
        transactionType: t.transactionType,
      }))
    );

    // Cross-domain: queries depreciation tables for financial year total
    const depreciationTotal = await getDepreciationTotal(
      ctx.db, ctx.portfolio.ownerId, startDate, endDate
    );

    return {
      totalIncome: metrics.totalIncome,
      totalExpenses: metrics.totalExpenses,
      netResult: metrics.netIncome,
      transactionCount: txns.length,
      depreciationTotal,
    };
  }),
```

Update `calculate` procedure (line 134-164) to accept depreciation:

Add to the input schema:
```typescript
depreciationDeductions: z.number().min(0).default(0),
```

Add to the `taxInput` object:
```typescript
depreciationDeductions: input.depreciationDeductions,
```

Update `getSummary` procedure (line 170-234) to include depreciation:

After the `metrics` calculation (around line 196), add:
```typescript
const depreciationTotal = await getDepreciationTotal(
  ctx.db, ctx.portfolio.ownerId, startDate, endDate
);
```

Pass it to `calculateTaxPosition` (around line 212):
```typescript
depreciationDeductions: depreciationTotal,
```

Add to both return objects (complete and teaser):
```typescript
depreciationTotal,
```

**Step 4: Verify TypeScript compiles**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx tsc --noEmit --pretty 2>&1 | grep -E "taxPosition|position" | head -20`
Expected: No new errors

**Step 5: Run existing tests**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx vitest run src/server/services/tax/`
Expected: All passing (existing tests should still pass — `depreciationDeductions` has a default value)

**Step 6: Commit**

```bash
git add src/server/services/tax/position.ts src/server/routers/tax/taxPosition.ts
git commit -m "feat: integrate depreciation deductions into tax position calculator"
```

---

### Task 5: Client-Side Preview in DepreciationTable

**Files:**
- Modify: `src/components/tax/DepreciationTable.tsx`

Add real-time deduction recalculation when users edit cost, life, or method.

**Step 1: Add client preview import and recalculation logic**

In `src/components/tax/DepreciationTable.tsx`:

Add import:
```typescript
import { calculateYearlyDeduction } from "@/lib/depreciation";
```

Add a `discrepancy` field to the `Asset` interface:
```typescript
interface Asset {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  yearlyDeduction: number;
  discrepancy?: boolean;
}
```

Update the `onUpdate` handler to recalculate deduction when relevant fields change. Replace the existing `onUpdate` prop usage in the cost, life, and method fields.

For the `originalCost` input `onChange`:
```typescript
onChange={(e) => {
  const newCost = parseFloat(e.target.value) || 0;
  onUpdate?.(index, "originalCost", newCost);
  onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(newCost, asset.effectiveLife, asset.method));
}}
```

For the `effectiveLife` input `onChange`:
```typescript
onChange={(e) => {
  const newLife = parseFloat(e.target.value) || 0;
  onUpdate?.(index, "effectiveLife", newLife);
  onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(asset.originalCost, newLife, asset.method));
}}
```

For the `method` Select `onValueChange`:
```typescript
onValueChange={(v) => {
  onUpdate?.(index, "method", v);
  onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(
    asset.originalCost,
    asset.effectiveLife,
    v as "diminishing_value" | "prime_cost"
  ));
}}
```

For the `category` Select `onValueChange`, add the Division 43 guardrail:
```typescript
onValueChange={(v) => {
  onUpdate?.(index, "category", v);
  if (v === "capital_works") {
    onUpdate?.(index, "method", "prime_cost");
    onUpdate?.(index, "effectiveLife", 40);
    onUpdate?.(index, "yearlyDeduction", calculateYearlyDeduction(asset.originalCost, 40, "prime_cost"));
  }
}}
```

Add a discrepancy indicator to the Annual Deduction cell:
```typescript
<TableCell className="text-right font-medium">
  <div className="flex items-center justify-end gap-1">
    {asset.discrepancy && (
      <span className="text-xs text-amber-500" title="Adjusted from AI estimate">
        *
      </span>
    )}
    {formatCurrency(asset.yearlyDeduction)}
  </div>
</TableCell>
```

Add a hint row below the table for capital works:
```typescript
{editable && (
  <p className="text-xs text-muted-foreground mt-2">
    * Capital works are typically depreciated at 2.5% (prime cost) over 40 years per ATO rules.
  </p>
)}
```

**Step 2: Verify TypeScript compiles**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx tsc --noEmit --pretty 2>&1 | grep "DepreciationTable"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/tax/DepreciationTable.tsx
git commit -m "feat: add real-time depreciation preview on asset edits"
```

---

### Task 6: Multi-Year Projection Router & UI

**Files:**
- Modify: `src/server/routers/tax/taxOptimization.ts` (add `getDepreciationProjection` procedure)
- Modify: `src/app/(dashboard)/reports/tax/TaxReportContent.tsx` (add projection toggle)

**Step 1: Add `getDepreciationProjection` procedure**

In `src/server/routers/tax/taxOptimization.ts`, add import:
```typescript
import { generateMultiYearSchedule } from "../../services/tax/depreciation-calc";
```

Add new procedure after `deleteDepreciationSchedule`:
```typescript
getDepreciationProjection: protectedProcedure
  .input(
    z.object({
      scheduleId: z.string().uuid(),
      years: z.number().int().min(1).max(40).optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const schedules = await ctx.uow.tax.findSchedules(ctx.portfolio.ownerId);
    const schedule = schedules.find((s) => s.id === input.scheduleId);

    if (!schedule) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found" });
    }

    const assetProjections = schedule.assets.map((asset) => {
      const originalCost = parseFloat(asset.originalCost);
      const effectiveLife = parseFloat(asset.effectiveLife);
      const method = asset.method;
      const years = input.years ?? Math.ceil(effectiveLife);

      return {
        assetName: asset.assetName,
        category: asset.category,
        schedule: generateMultiYearSchedule(originalCost, effectiveLife, method, years),
      };
    });

    // Calculate totals per year
    const maxYears = Math.max(...assetProjections.map((a) => a.schedule.length));
    const yearlyTotals: Array<{ year: number; totalDeduction: number; totalRemaining: number }> = [];

    for (let y = 0; y < maxYears; y++) {
      let totalDeduction = 0;
      let totalRemaining = 0;

      for (const ap of assetProjections) {
        if (y < ap.schedule.length) {
          totalDeduction += ap.schedule[y].deduction;
          totalRemaining += ap.schedule[y].closingValue;
        }
      }

      yearlyTotals.push({
        year: y + 1,
        totalDeduction: Math.round(totalDeduction * 100) / 100,
        totalRemaining: Math.round(totalRemaining * 100) / 100,
      });
    }

    return {
      scheduleId: schedule.id,
      propertyAddress: schedule.property?.address ?? "Unknown",
      assetProjections,
      yearlyTotals,
    };
  }),
```

**Step 2: Add projection toggle to DepreciationSchedulesList**

In `src/app/(dashboard)/reports/tax/TaxReportContent.tsx`, update the `DepreciationSchedulesList` component (line 188+).

Add imports at the top of the file:
```typescript
import { ChevronDown, ChevronRight, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
```

Replace the `DepreciationSchedulesList` function with:

```typescript
function DepreciationSchedulesList() {
  const { data: schedules, isLoading } =
    trpc.taxOptimization.getDepreciationSchedules.useQuery({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!schedules || schedules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No depreciation schedules uploaded yet. Upload a quantity surveyor report to track depreciation.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {schedules.map((schedule) => (
        <div key={schedule.id} className="border rounded-lg">
          <div className="flex items-center justify-between p-3">
            <div>
              <p className="font-medium">{schedule.property?.address}</p>
              <p className="text-sm text-muted-foreground">
                {schedule.assets?.length || 0} assets • $
                {parseFloat(schedule.totalValue).toLocaleString()} total
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Effective {schedule.effectiveDate}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExpandedId(expandedId === schedule.id ? null : schedule.id)
                }
              >
                {expandedId === schedule.id ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span className="ml-1 text-xs">Projection</span>
              </Button>
            </div>
          </div>
          {expandedId === schedule.id && (
            <DepreciationProjection scheduleId={schedule.id} />
          )}
        </div>
      ))}
    </div>
  );
}
```

Add the `DepreciationProjection` component below:

```typescript
function DepreciationProjection({ scheduleId }: { scheduleId: string }) {
  const { data, isLoading } = trpc.taxOptimization.getDepreciationProjection.useQuery({
    scheduleId,
    years: 10,
  });

  if (isLoading) {
    return (
      <div className="px-3 pb-3">
        <p className="text-sm text-muted-foreground">Loading projection...</p>
      </div>
    );
  }

  if (!data || data.yearlyTotals.length === 0) {
    return (
      <div className="px-3 pb-3">
        <p className="text-sm text-muted-foreground">No projection data available.</p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-3 border-t">
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 pr-4 text-muted-foreground font-medium">Year</th>
              <th className="text-right py-1 px-4 font-medium">Total Deduction</th>
              <th className="text-right py-1 px-4 font-medium">Remaining Value</th>
            </tr>
          </thead>
          <tbody>
            {data.yearlyTotals.map((row) => (
              <tr key={row.year} className="border-b last:border-0">
                <td className="py-1 pr-4 text-muted-foreground">{row.year}</td>
                <td className="text-right py-1 px-4 font-mono">
                  {formatCurrency(row.totalDeduction)}
                </td>
                <td className="text-right py-1 px-4 font-mono">
                  {formatCurrency(row.totalRemaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx tsc --noEmit --pretty 2>&1 | grep -E "TaxReport|taxOptimization" | head -10`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/server/routers/tax/taxOptimization.ts src/app/\(dashboard\)/reports/tax/TaxReportContent.tsx
git commit -m "feat: add multi-year depreciation projection with expandable UI"
```

---

### Task 7: Final Verification & Cleanup

**Files:**
- No new files — verification pass

**Step 1: Run TypeScript check**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx tsc --noEmit --pretty`
Expected: No new errors (pre-existing ones OK)

**Step 2: Run all new unit tests**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx vitest run src/server/services/tax/__tests__/depreciation-calc.test.ts src/lib/__tests__/depreciation.test.ts`
Expected: All passing

**Step 3: Run full test suite**

Run: `cd ~/worktrees/property-tracker/depreciation-parser && npx vitest run`
Expected: All passing (pre-existing failures OK)

**Step 4: Verify barrel exports**

Check that `src/server/services/tax/index.ts` exports the new calc service. Check that no import paths are broken.

**Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: depreciation parser cleanup and verification"
```
