# Tax Position Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive tax position calculator showing estimated refund/owing with rental property savings highlighted.

**Architecture:** New `taxProfiles` table stores user tax data per FY. Stateless calculation service handles tax brackets, Medicare, MLS, HECS. Dashboard card shows summary, dedicated page shows full breakdown with what-if editing.

**Tech Stack:** Drizzle ORM, tRPC, React, shadcn/ui, Zod validation

**Design Document:** `docs/plans/2026-01-26-tax-position-calculator-design.md`

---

## Phase 1: Data Layer

### Task 1: Add Tax Tables Library

**Files:**
- Create: `src/lib/tax-tables.ts`

**Step 1: Create tax tables file**

```typescript
// src/lib/tax-tables.ts

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  base: number;
}

export interface HECSRate {
  min: number;
  max: number;
  rate: number;
}

export interface MLSTier {
  min: number;
  max: number;
  rate: number;
}

export interface TaxTable {
  brackets: TaxBracket[];
  medicareLevy: number;
  medicareLevyLowIncomeThreshold: number;
  mlsThresholds: {
    single: number;
    family: number;
    childAdd: number;
  };
  mlsTiers: MLSTier[];
  hecsRates: HECSRate[];
}

// FY2025-26 (ending June 30, 2026) - Post Stage 3 tax cuts
const FY2026: TaxTable = {
  brackets: [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.16, base: 0 },
    { min: 45001, max: 135000, rate: 0.30, base: 4288 },
    { min: 135001, max: 190000, rate: 0.37, base: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
  ],
  medicareLevy: 0.02,
  medicareLevyLowIncomeThreshold: 26000,
  mlsThresholds: {
    single: 93000,
    family: 186000,
    childAdd: 1500,
  },
  mlsTiers: [
    { min: 0, max: 93000, rate: 0 },
    { min: 93001, max: 108000, rate: 0.01 },
    { min: 108001, max: 144000, rate: 0.0125 },
    { min: 144001, max: Infinity, rate: 0.015 },
  ],
  hecsRates: [
    { min: 0, max: 54435, rate: 0 },
    { min: 54436, max: 62850, rate: 0.01 },
    { min: 62851, max: 66620, rate: 0.02 },
    { min: 66621, max: 70618, rate: 0.025 },
    { min: 70619, max: 74855, rate: 0.03 },
    { min: 74856, max: 79346, rate: 0.035 },
    { min: 79347, max: 84107, rate: 0.04 },
    { min: 84108, max: 89154, rate: 0.045 },
    { min: 89155, max: 94503, rate: 0.05 },
    { min: 94504, max: 100174, rate: 0.055 },
    { min: 100175, max: 106185, rate: 0.06 },
    { min: 106186, max: 112556, rate: 0.065 },
    { min: 112557, max: 119309, rate: 0.07 },
    { min: 119310, max: 126467, rate: 0.075 },
    { min: 126468, max: 134056, rate: 0.08 },
    { min: 134057, max: 142100, rate: 0.085 },
    { min: 142101, max: 150626, rate: 0.09 },
    { min: 150627, max: 159663, rate: 0.095 },
    { min: 159664, max: Infinity, rate: 0.10 },
  ],
};

// FY2024-25 (ending June 30, 2025) - Post Stage 3 tax cuts
const FY2025: TaxTable = {
  brackets: [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.16, base: 0 },
    { min: 45001, max: 135000, rate: 0.30, base: 4288 },
    { min: 135001, max: 190000, rate: 0.37, base: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
  ],
  medicareLevy: 0.02,
  medicareLevyLowIncomeThreshold: 24276,
  mlsThresholds: {
    single: 93000,
    family: 186000,
    childAdd: 1500,
  },
  mlsTiers: [
    { min: 0, max: 93000, rate: 0 },
    { min: 93001, max: 108000, rate: 0.01 },
    { min: 108001, max: 144000, rate: 0.0125 },
    { min: 144001, max: Infinity, rate: 0.015 },
  ],
  hecsRates: [
    { min: 0, max: 51550, rate: 0 },
    { min: 51551, max: 59518, rate: 0.01 },
    { min: 59519, max: 63089, rate: 0.02 },
    { min: 63090, max: 66875, rate: 0.025 },
    { min: 66876, max: 70888, rate: 0.03 },
    { min: 70889, max: 75140, rate: 0.035 },
    { min: 75141, max: 79649, rate: 0.04 },
    { min: 79650, max: 84429, rate: 0.045 },
    { min: 84430, max: 89494, rate: 0.05 },
    { min: 89495, max: 94865, rate: 0.055 },
    { min: 94866, max: 100557, rate: 0.06 },
    { min: 100558, max: 106590, rate: 0.065 },
    { min: 106591, max: 112985, rate: 0.07 },
    { min: 112986, max: 119764, rate: 0.075 },
    { min: 119765, max: 126950, rate: 0.08 },
    { min: 126951, max: 134568, rate: 0.085 },
    { min: 134569, max: 142642, rate: 0.09 },
    { min: 142643, max: 151200, rate: 0.095 },
    { min: 151201, max: Infinity, rate: 0.10 },
  ],
};

// FY2023-24 (ending June 30, 2024) - Pre Stage 3 tax cuts
const FY2024: TaxTable = {
  brackets: [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.19, base: 0 },
    { min: 45001, max: 120000, rate: 0.325, base: 5092 },
    { min: 120001, max: 180000, rate: 0.37, base: 29467 },
    { min: 180001, max: Infinity, rate: 0.45, base: 51667 },
  ],
  medicareLevy: 0.02,
  medicareLevyLowIncomeThreshold: 23365,
  mlsThresholds: {
    single: 90000,
    family: 180000,
    childAdd: 1500,
  },
  mlsTiers: [
    { min: 0, max: 90000, rate: 0 },
    { min: 90001, max: 105000, rate: 0.01 },
    { min: 105001, max: 140000, rate: 0.0125 },
    { min: 140001, max: Infinity, rate: 0.015 },
  ],
  hecsRates: [
    { min: 0, max: 51550, rate: 0 },
    { min: 51551, max: 59518, rate: 0.01 },
    { min: 59519, max: 63089, rate: 0.02 },
    { min: 63090, max: 66875, rate: 0.025 },
    { min: 66876, max: 70888, rate: 0.03 },
    { min: 70889, max: 75140, rate: 0.035 },
    { min: 75141, max: 79649, rate: 0.04 },
    { min: 79650, max: 84429, rate: 0.045 },
    { min: 84430, max: 89494, rate: 0.05 },
    { min: 89495, max: 94865, rate: 0.055 },
    { min: 94866, max: 100557, rate: 0.06 },
    { min: 100558, max: 106590, rate: 0.065 },
    { min: 106591, max: 112985, rate: 0.07 },
    { min: 112986, max: 119764, rate: 0.075 },
    { min: 119765, max: 126950, rate: 0.08 },
    { min: 126951, max: 134568, rate: 0.085 },
    { min: 134569, max: 142642, rate: 0.09 },
    { min: 142643, max: 151200, rate: 0.095 },
    { min: 151201, max: Infinity, rate: 0.10 },
  ],
};

export const TAX_TABLES: Record<number, TaxTable> = {
  2026: FY2026,
  2025: FY2025,
  2024: FY2024,
};

export function getTaxTable(financialYear: number): TaxTable | null {
  return TAX_TABLES[financialYear] ?? null;
}

export function getSupportedFinancialYears(): number[] {
  return Object.keys(TAX_TABLES).map(Number).sort((a, b) => b - a);
}

export function getCurrentFinancialYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 6 = Jul)
  const year = now.getFullYear();
  // FY ends June 30, so if we're in Jul-Dec, we're in the FY ending next year
  return month >= 6 ? year + 1 : year;
}
```

**Step 2: Commit**

```bash
git add src/lib/tax-tables.ts
git commit -m "feat(tax): add Australian tax tables for FY2024-2026"
```

---

### Task 2: Add Tax Profiles Schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add familyStatusEnum and taxProfiles table**

Add after existing enums (around line 340, before `// Tables`):

```typescript
export const familyStatusEnum = pgEnum("family_status", [
  "single",
  "couple",
  "family",
]);
```

Add after existing tables (at end of file, before relations):

```typescript
export const taxProfiles = pgTable(
  "tax_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: integer("financial_year").notNull(),

    // Income
    grossSalary: decimal("gross_salary", { precision: 12, scale: 2 }),
    paygWithheld: decimal("payg_withheld", { precision: 12, scale: 2 }),
    otherDeductions: decimal("other_deductions", { precision: 12, scale: 2 }).default("0"),

    // HECS/HELP
    hasHecsDebt: boolean("has_hecs_debt").default(false).notNull(),

    // Medicare Levy Surcharge
    hasPrivateHealth: boolean("has_private_health").default(false).notNull(),
    familyStatus: familyStatusEnum("family_status").default("single").notNull(),
    dependentChildren: integer("dependent_children").default(0).notNull(),
    partnerIncome: decimal("partner_income", { precision: 12, scale: 2 }),

    // Metadata
    isComplete: boolean("is_complete").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_profiles_user_year_idx").on(table.userId, table.financialYear),
  ]
);

export type TaxProfile = typeof taxProfiles.$inferSelect;
export type NewTaxProfile = typeof taxProfiles.$inferInsert;
```

Add relations (in the relations section):

```typescript
export const taxProfilesRelations = relations(taxProfiles, ({ one }) => ({
  user: one(users, {
    fields: [taxProfiles.userId],
    references: [users.id],
  }),
}));
```

**Step 2: Generate migration**

```bash
npm run db:generate
```

**Step 3: Push to database**

```bash
npm run db:push
```

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(tax): add taxProfiles table schema"
```

---

### Task 3: Create Tax Position Service

**Files:**
- Create: `src/server/services/tax-position.ts`

**Step 1: Create the service file**

```typescript
// src/server/services/tax-position.ts

import { getTaxTable, getCurrentFinancialYear, type TaxTable } from "@/lib/tax-tables";

export type FamilyStatus = "single" | "couple" | "family";

export interface TaxPositionInput {
  financialYear: number;
  grossSalary: number;
  paygWithheld: number;
  rentalNetResult: number; // negative = loss, positive = profit
  otherDeductions: number;
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  familyStatus: FamilyStatus;
  dependentChildren: number;
  partnerIncome: number;
}

export interface TaxPositionResult {
  financialYear: number;

  // Income
  grossSalary: number;
  rentalNetResult: number;
  taxableIncome: number;

  // Deductions
  otherDeductions: number;
  totalDeductions: number;

  // Tax calculation
  baseTax: number;
  medicareLevy: number;
  medicareLevySurcharge: number;
  hecsRepayment: number;
  totalTaxLiability: number;

  // Result
  paygWithheld: number;
  refundOrOwing: number; // positive = refund, negative = owing
  isRefund: boolean;

  // Property impact
  marginalRate: number;
  propertySavings: number; // tax benefit from rental losses

  // MLS details (for UI)
  mlsApplies: boolean;
  mlsThreshold: number;
  combinedIncome: number;
}

/**
 * Calculate base tax using marginal brackets
 */
function calculateBaseTax(taxableIncome: number, table: TaxTable): number {
  if (taxableIncome <= 0) return 0;

  for (const bracket of table.brackets) {
    if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
      return bracket.base + (taxableIncome - bracket.min + 1) * bracket.rate;
    }
  }

  // Should not reach here, but handle edge case
  const lastBracket = table.brackets[table.brackets.length - 1];
  return lastBracket.base + (taxableIncome - lastBracket.min + 1) * lastBracket.rate;
}

/**
 * Get marginal tax rate for a given taxable income
 */
function getMarginalRate(taxableIncome: number, table: TaxTable): number {
  if (taxableIncome <= 0) return 0;

  for (const bracket of table.brackets) {
    if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
      return bracket.rate;
    }
  }

  return table.brackets[table.brackets.length - 1].rate;
}

/**
 * Calculate Medicare Levy (2% of taxable income above threshold)
 */
function calculateMedicareLevy(taxableIncome: number, table: TaxTable): number {
  if (taxableIncome <= table.medicareLevyLowIncomeThreshold) return 0;
  return Math.max(0, taxableIncome * table.medicareLevy);
}

/**
 * Calculate Medicare Levy Surcharge
 * Applies to high income earners without private health insurance
 */
function calculateMLS(
  taxableIncome: number,
  hasPrivateHealth: boolean,
  familyStatus: FamilyStatus,
  dependentChildren: number,
  partnerIncome: number,
  table: TaxTable
): { surcharge: number; applies: boolean; threshold: number; combinedIncome: number } {
  if (hasPrivateHealth) {
    return { surcharge: 0, applies: false, threshold: 0, combinedIncome: 0 };
  }

  // Determine threshold based on family status
  let threshold = table.mlsThresholds.single;
  let incomeForMLS = taxableIncome;

  if (familyStatus === "couple" || familyStatus === "family") {
    threshold = table.mlsThresholds.family;
    // Add $1,500 for each dependent child after the first
    if (dependentChildren > 1) {
      threshold += (dependentChildren - 1) * table.mlsThresholds.childAdd;
    }
    // Combined income for family threshold
    incomeForMLS = taxableIncome + (partnerIncome || 0);
  }

  if (incomeForMLS <= threshold) {
    return { surcharge: 0, applies: false, threshold, combinedIncome: incomeForMLS };
  }

  // Find applicable MLS tier (based on individual income, not combined)
  let rate = 0;
  for (const tier of table.mlsTiers) {
    if (taxableIncome >= tier.min && taxableIncome <= tier.max) {
      rate = tier.rate;
      break;
    }
  }

  return {
    surcharge: taxableIncome * rate,
    applies: true,
    threshold,
    combinedIncome: incomeForMLS,
  };
}

/**
 * Calculate HECS/HELP repayment
 */
function calculateHECS(
  repaymentIncome: number,
  hasHecsDebt: boolean,
  table: TaxTable
): number {
  if (!hasHecsDebt) return 0;

  for (const tier of table.hecsRates) {
    if (repaymentIncome >= tier.min && repaymentIncome <= tier.max) {
      return repaymentIncome * tier.rate;
    }
  }

  return 0;
}

/**
 * Main calculation function
 */
export function calculateTaxPosition(input: TaxPositionInput): TaxPositionResult {
  const table = getTaxTable(input.financialYear);
  if (!table) {
    throw new Error(`Tax tables not available for FY${input.financialYear}`);
  }

  // Calculate taxable income
  // Rental loss reduces taxable income (negative gearing)
  // Rental profit increases taxable income
  const rentalAdjustment = input.rentalNetResult; // already signed correctly
  const taxableIncome = Math.max(
    0,
    input.grossSalary + rentalAdjustment - input.otherDeductions
  );

  // Calculate tax components
  const baseTax = calculateBaseTax(taxableIncome, table);
  const medicareLevy = calculateMedicareLevy(taxableIncome, table);
  const mls = calculateMLS(
    taxableIncome,
    input.hasPrivateHealth,
    input.familyStatus,
    input.dependentChildren,
    input.partnerIncome,
    table
  );

  // HECS repayment income includes salary + rental + any reportable fringe benefits
  // For simplicity, we use gross salary + rental net result
  const repaymentIncome = input.grossSalary + input.rentalNetResult;
  const hecsRepayment = calculateHECS(repaymentIncome, input.hasHecsDebt, table);

  // Total tax liability
  const totalTaxLiability = baseTax + medicareLevy + mls.surcharge + hecsRepayment;

  // Refund or owing
  const refundOrOwing = input.paygWithheld - totalTaxLiability;

  // Calculate property savings (tax benefit from rental losses)
  const marginalRate = getMarginalRate(input.grossSalary, table); // Use salary for marginal rate
  const propertySavings = input.rentalNetResult < 0
    ? Math.abs(input.rentalNetResult) * marginalRate
    : 0;

  // Total deductions for display
  const rentalDeduction = input.rentalNetResult < 0 ? Math.abs(input.rentalNetResult) : 0;
  const totalDeductions = rentalDeduction + input.otherDeductions;

  return {
    financialYear: input.financialYear,
    grossSalary: input.grossSalary,
    rentalNetResult: input.rentalNetResult,
    taxableIncome,
    otherDeductions: input.otherDeductions,
    totalDeductions,
    baseTax,
    medicareLevy,
    medicareLevySurcharge: mls.surcharge,
    hecsRepayment,
    totalTaxLiability,
    paygWithheld: input.paygWithheld,
    refundOrOwing,
    isRefund: refundOrOwing >= 0,
    marginalRate,
    propertySavings,
    mlsApplies: mls.applies,
    mlsThreshold: mls.threshold,
    combinedIncome: mls.combinedIncome,
  };
}

/**
 * Quick estimate based on rental loss and tax bracket
 * Used for preview teaser before profile is set up
 */
export function estimatePropertySavings(
  rentalNetResult: number,
  assumedMarginalRate: number = 0.37
): number {
  if (rentalNetResult >= 0) return 0;
  return Math.abs(rentalNetResult) * assumedMarginalRate;
}
```

**Step 2: Commit**

```bash
git add src/server/services/tax-position.ts
git commit -m "feat(tax): add tax position calculation service"
```

---

### Task 4: Create Tax Position Service Tests

**Files:**
- Create: `src/server/services/__tests__/tax-position.test.ts`

**Step 1: Create test file**

```typescript
// src/server/services/__tests__/tax-position.test.ts

import { describe, expect, it } from "vitest";
import {
  calculateTaxPosition,
  estimatePropertySavings,
  type TaxPositionInput,
} from "../tax-position";

describe("calculateTaxPosition", () => {
  const baseInput: TaxPositionInput = {
    financialYear: 2026,
    grossSalary: 95000,
    paygWithheld: 22000,
    rentalNetResult: -12400, // loss
    otherDeductions: 2500,
    hasHecsDebt: false,
    hasPrivateHealth: true,
    familyStatus: "single",
    dependentChildren: 0,
    partnerIncome: 0,
  };

  it("calculates basic tax position with rental loss", () => {
    const result = calculateTaxPosition(baseInput);

    expect(result.financialYear).toBe(2026);
    expect(result.grossSalary).toBe(95000);
    expect(result.rentalNetResult).toBe(-12400);
    expect(result.taxableIncome).toBe(80100); // 95000 - 12400 - 2500
    expect(result.isRefund).toBe(true);
    expect(result.propertySavings).toBeGreaterThan(0);
  });

  it("calculates zero tax for low income", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 18000,
      paygWithheld: 0,
      rentalNetResult: 0,
      otherDeductions: 0,
    });

    expect(result.baseTax).toBe(0);
    expect(result.taxableIncome).toBe(18000);
  });

  it("handles rental profit (increases tax)", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      rentalNetResult: 5000, // profit
    });

    expect(result.taxableIncome).toBe(97500); // 95000 + 5000 - 2500
    expect(result.propertySavings).toBe(0); // no savings on profit
  });

  it("applies Medicare Levy Surcharge when no private health", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      hasPrivateHealth: false,
    });

    expect(result.mlsApplies).toBe(false); // taxable income 80100 < 93000 threshold
  });

  it("applies MLS for high income without private health", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 150000,
      paygWithheld: 45000,
      rentalNetResult: 0,
      otherDeductions: 0,
      hasPrivateHealth: false,
    });

    expect(result.mlsApplies).toBe(true);
    expect(result.medicareLevySurcharge).toBeGreaterThan(0);
  });

  it("calculates HECS repayment when debt exists", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      hasHecsDebt: true,
    });

    expect(result.hecsRepayment).toBeGreaterThan(0);
  });

  it("calculates no HECS below threshold", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 50000,
      paygWithheld: 8000,
      rentalNetResult: 0,
      hasHecsDebt: true,
    });

    expect(result.hecsRepayment).toBe(0);
  });

  it("uses family MLS threshold for couples", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 100000,
      hasPrivateHealth: false,
      familyStatus: "couple",
      partnerIncome: 50000,
    });

    // Combined income 150000 < 186000 family threshold
    expect(result.mlsApplies).toBe(false);
  });

  it("handles negative taxable income as zero", () => {
    const result = calculateTaxPosition({
      ...baseInput,
      grossSalary: 20000,
      rentalNetResult: -30000,
      otherDeductions: 5000,
    });

    expect(result.taxableIncome).toBe(0);
    expect(result.baseTax).toBe(0);
  });

  it("throws error for unsupported financial year", () => {
    expect(() =>
      calculateTaxPosition({
        ...baseInput,
        financialYear: 2020,
      })
    ).toThrow("Tax tables not available");
  });
});

describe("estimatePropertySavings", () => {
  it("estimates savings from rental loss", () => {
    const savings = estimatePropertySavings(-12400, 0.37);
    expect(savings).toBe(4588);
  });

  it("returns zero for rental profit", () => {
    const savings = estimatePropertySavings(5000, 0.37);
    expect(savings).toBe(0);
  });

  it("uses default marginal rate", () => {
    const savings = estimatePropertySavings(-10000);
    expect(savings).toBe(3700); // 10000 * 0.37
  });
});
```

**Step 2: Run tests**

```bash
npm run test -- src/server/services/__tests__/tax-position.test.ts
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/services/__tests__/tax-position.test.ts
git commit -m "test(tax): add tax position calculation tests"
```

---

### Task 5: Create Tax Position Router

**Files:**
- Create: `src/server/routers/taxPosition.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create router file**

```typescript
// src/server/routers/taxPosition.ts

import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { taxProfiles } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateTaxPosition,
  estimatePropertySavings,
  type TaxPositionInput,
} from "../services/tax-position";
import {
  getCurrentFinancialYear,
  getSupportedFinancialYears,
} from "@/lib/tax-tables";
import {
  getFinancialYearRange,
  calculatePropertyMetrics,
} from "../services/reports";
import { transactions } from "../db/schema";
import { gte, lte } from "drizzle-orm";

const familyStatusSchema = z.enum(["single", "couple", "family"]);

const taxProfileSchema = z.object({
  financialYear: z.number().int().min(2020).max(2030),
  grossSalary: z.number().min(0).optional(),
  paygWithheld: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).default(0),
  hasHecsDebt: z.boolean().default(false),
  hasPrivateHealth: z.boolean().default(false),
  familyStatus: familyStatusSchema.default("single"),
  dependentChildren: z.number().int().min(0).default(0),
  partnerIncome: z.number().min(0).optional(),
  isComplete: z.boolean().default(false),
});

export const taxPositionRouter = router({
  /**
   * Get supported financial years
   */
  getSupportedYears: protectedProcedure.query(() => {
    return getSupportedFinancialYears().map((year) => ({
      year,
      label: `FY ${year - 1}-${String(year).slice(-2)}`,
      isCurrent: year === getCurrentFinancialYear(),
    }));
  }),

  /**
   * Get current financial year
   */
  getCurrentYear: protectedProcedure.query(() => {
    return getCurrentFinancialYear();
  }),

  /**
   * Get saved tax profile for a financial year
   */
  getProfile: protectedProcedure
    .input(z.object({ financialYear: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.query.taxProfiles.findFirst({
        where: and(
          eq(taxProfiles.userId, ctx.portfolio.ownerId),
          eq(taxProfiles.financialYear, input.financialYear)
        ),
      });

      return profile ?? null;
    }),

  /**
   * Save tax profile
   */
  saveProfile: writeProcedure
    .input(taxProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.taxProfiles.findFirst({
        where: and(
          eq(taxProfiles.userId, ctx.portfolio.ownerId),
          eq(taxProfiles.financialYear, input.financialYear)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(taxProfiles)
          .set({
            grossSalary: input.grossSalary?.toString(),
            paygWithheld: input.paygWithheld?.toString(),
            otherDeductions: input.otherDeductions.toString(),
            hasHecsDebt: input.hasHecsDebt,
            hasPrivateHealth: input.hasPrivateHealth,
            familyStatus: input.familyStatus,
            dependentChildren: input.dependentChildren,
            partnerIncome: input.partnerIncome?.toString(),
            isComplete: input.isComplete,
            updatedAt: new Date(),
          })
          .where(eq(taxProfiles.id, existing.id))
          .returning();

        return updated;
      }

      const [created] = await ctx.db
        .insert(taxProfiles)
        .values({
          userId: ctx.portfolio.ownerId,
          financialYear: input.financialYear,
          grossSalary: input.grossSalary?.toString(),
          paygWithheld: input.paygWithheld?.toString(),
          otherDeductions: input.otherDeductions.toString(),
          hasHecsDebt: input.hasHecsDebt,
          hasPrivateHealth: input.hasPrivateHealth,
          familyStatus: input.familyStatus,
          dependentChildren: input.dependentChildren,
          partnerIncome: input.partnerIncome?.toString(),
          isComplete: input.isComplete,
        })
        .returning();

      return created;
    }),

  /**
   * Get rental net result for a financial year
   */
  getRentalResult: protectedProcedure
    .input(z.object({ financialYear: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = getFinancialYearRange(input.financialYear);

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

      return {
        totalIncome: metrics.totalIncome,
        totalExpenses: metrics.totalExpenses,
        netResult: metrics.netIncome, // negative = loss
        transactionCount: txns.length,
      };
    }),

  /**
   * Calculate tax position (stateless - accepts all inputs)
   */
  calculate: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().int(),
        grossSalary: z.number().min(0),
        paygWithheld: z.number().min(0),
        rentalNetResult: z.number(), // can be negative (loss) or positive (profit)
        otherDeductions: z.number().min(0).default(0),
        hasHecsDebt: z.boolean().default(false),
        hasPrivateHealth: z.boolean().default(false),
        familyStatus: familyStatusSchema.default("single"),
        dependentChildren: z.number().int().min(0).default(0),
        partnerIncome: z.number().min(0).default(0),
      })
    )
    .query(({ input }) => {
      const taxInput: TaxPositionInput = {
        financialYear: input.financialYear,
        grossSalary: input.grossSalary,
        paygWithheld: input.paygWithheld,
        rentalNetResult: input.rentalNetResult,
        otherDeductions: input.otherDeductions,
        hasHecsDebt: input.hasHecsDebt,
        hasPrivateHealth: input.hasPrivateHealth,
        familyStatus: input.familyStatus,
        dependentChildren: input.dependentChildren,
        partnerIncome: input.partnerIncome,
      };

      return calculateTaxPosition(taxInput);
    }),

  /**
   * Get quick summary for dashboard card
   * Returns null if profile not complete
   */
  getSummary: protectedProcedure
    .input(z.object({ financialYear: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.financialYear ?? getCurrentFinancialYear();

      // Get profile
      const profile = await ctx.db.query.taxProfiles.findFirst({
        where: and(
          eq(taxProfiles.userId, ctx.portfolio.ownerId),
          eq(taxProfiles.financialYear, year)
        ),
      });

      // Get rental result
      const { startDate, endDate } = getFinancialYearRange(year);
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

      const rentalNetResult = metrics.netIncome;

      // If no complete profile, return teaser data
      if (!profile?.isComplete) {
        const estimatedSavings = estimatePropertySavings(rentalNetResult, 0.37);
        return {
          isComplete: false,
          financialYear: year,
          rentalNetResult,
          estimatedSavings,
          refundOrOwing: null,
          propertySavings: null,
        };
      }

      // Calculate full position
      const result = calculateTaxPosition({
        financialYear: year,
        grossSalary: Number(profile.grossSalary ?? 0),
        paygWithheld: Number(profile.paygWithheld ?? 0),
        rentalNetResult,
        otherDeductions: Number(profile.otherDeductions ?? 0),
        hasHecsDebt: profile.hasHecsDebt,
        hasPrivateHealth: profile.hasPrivateHealth,
        familyStatus: profile.familyStatus,
        dependentChildren: profile.dependentChildren,
        partnerIncome: Number(profile.partnerIncome ?? 0),
      });

      return {
        isComplete: true,
        financialYear: year,
        rentalNetResult,
        estimatedSavings: null,
        refundOrOwing: result.refundOrOwing,
        propertySavings: result.propertySavings,
        isRefund: result.isRefund,
      };
    }),
});
```

**Step 2: Register router in _app.ts**

Add import at top:

```typescript
import { taxPositionRouter } from "./taxPosition";
```

Add to router object:

```typescript
taxPosition: taxPositionRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/taxPosition.ts src/server/routers/_app.ts
git commit -m "feat(tax): add taxPosition tRPC router"
```

---

## Phase 2: UI Components

### Task 6: Create Tax Position Card Component

**Files:**
- Create: `src/components/tax-position/TaxPositionCard.tsx`

**Step 1: Create component**

```typescript
// src/components/tax-position/TaxPositionCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { Calculator, Home, ArrowRight, Loader2 } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

export function TaxPositionCard() {
  const { data: summary, isLoading } = trpc.taxPosition.getSummary.useQuery({});

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load</p>
        </CardContent>
      </Card>
    );
  }

  const fyLabel = `FY${summary.financialYear - 1}-${String(summary.financialYear).slice(-2)}`;

  // Not set up state
  if (!summary.isComplete) {
    return (
      <Link href="/reports/tax-position">
        <Card className="cursor-pointer transition-colors hover:bg-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
            <span className="text-xs text-muted-foreground">{fyLabel}</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                See your estimated refund
              </p>
              <Button size="sm" variant="outline" className="w-full">
                Set up in 2 min
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Complete state
  const isRefund = summary.isRefund ?? true;
  const amount = summary.refundOrOwing ?? 0;
  const propertySavings = summary.propertySavings ?? 0;

  return (
    <Link href="/reports/tax-position">
      <Card className="cursor-pointer transition-colors hover:bg-secondary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Position</CardTitle>
          <span className="text-xs text-muted-foreground">{fyLabel}</span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isRefund ? "Estimated Refund" : "Estimated Owing"}
            </p>
            <p
              className={`text-2xl font-bold ${
                isRefund ? "text-green-600" : "text-amber-600"
              }`}
            >
              {formatCurrency(amount)}
            </p>
            {propertySavings > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Home className="h-3 w-3" />
                Properties {isRefund ? "saved" : "reduced by"} you{" "}
                {formatCurrency(propertySavings)}
              </p>
            )}
            <p className="text-xs text-primary flex items-center gap-1 pt-1">
              View details
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tax-position/TaxPositionCard.tsx
git commit -m "feat(tax): add TaxPositionCard dashboard component"
```

---

### Task 7: Add Tax Position Card to Dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Import and add card**

Add import:

```typescript
import { TaxPositionCard } from "@/components/tax-position/TaxPositionCard";
```

Find the grid of cards (around line 100-130) and add TaxPositionCard after the existing cards:

```typescript
<TaxPositionCard />
```

**Step 2: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat(tax): add TaxPositionCard to dashboard"
```

---

### Task 8: Create Tax Position Page

**Files:**
- Create: `src/app/(dashboard)/reports/tax-position/page.tsx`
- Create: `src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx`

**Step 1: Create page.tsx**

```typescript
// src/app/(dashboard)/reports/tax-position/page.tsx

import { Suspense } from "react";
import { TaxPositionContent } from "./TaxPositionContent";

export const dynamic = "force-dynamic";

function TaxPositionLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Position</h2>
        <p className="text-muted-foreground">
          Your estimated tax outcome for the financial year
        </p>
      </div>
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function TaxPositionPage() {
  return (
    <Suspense fallback={<TaxPositionLoading />}>
      <TaxPositionContent />
    </Suspense>
  );
}
```

**Step 2: Create TaxPositionContent.tsx**

```typescript
// src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { SetupWizard } from "@/components/tax-position/SetupWizard";
import {
  Calculator,
  Home,
  AlertCircle,
  Save,
  RotateCcw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

type FamilyStatus = "single" | "couple" | "family";

interface FormState {
  grossSalary: string;
  paygWithheld: string;
  rentalOverride: string | null;
  otherDeductions: string;
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  familyStatus: FamilyStatus;
  dependentChildren: string;
  partnerIncome: string;
}

export function TaxPositionContent() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    grossSalary: "",
    paygWithheld: "",
    rentalOverride: null,
    otherDeductions: "0",
    hasHecsDebt: false,
    hasPrivateHealth: true,
    familyStatus: "single",
    dependentChildren: "0",
    partnerIncome: "",
  });

  const { data: supportedYears } = trpc.taxPosition.getSupportedYears.useQuery();
  const { data: currentYear } = trpc.taxPosition.getCurrentYear.useQuery();

  // Set initial year
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  const { data: profile, refetch: refetchProfile } =
    trpc.taxPosition.getProfile.useQuery(
      { financialYear: selectedYear! },
      { enabled: !!selectedYear }
    );

  const { data: rentalResult } = trpc.taxPosition.getRentalResult.useQuery(
    { financialYear: selectedYear! },
    { enabled: !!selectedYear }
  );

  // Initialize form from profile
  useEffect(() => {
    if (profile) {
      setFormState({
        grossSalary: profile.grossSalary ?? "",
        paygWithheld: profile.paygWithheld ?? "",
        rentalOverride: null,
        otherDeductions: profile.otherDeductions ?? "0",
        hasHecsDebt: profile.hasHecsDebt,
        hasPrivateHealth: profile.hasPrivateHealth,
        familyStatus: profile.familyStatus as FamilyStatus,
        dependentChildren: String(profile.dependentChildren),
        partnerIncome: profile.partnerIncome ?? "",
      });
    }
  }, [profile]);

  // Show wizard if no complete profile
  useEffect(() => {
    if (profile === null && selectedYear) {
      setShowWizard(true);
    }
  }, [profile, selectedYear]);

  const saveProfile = trpc.taxPosition.saveProfile.useMutation({
    onSuccess: () => {
      toast.success("Tax profile saved");
      refetchProfile();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save profile");
    },
  });

  // Calculate current values
  const rentalNet =
    formState.rentalOverride !== null
      ? parseFloat(formState.rentalOverride) || 0
      : rentalResult?.netResult ?? 0;

  const calculationInput = useMemo(
    () => ({
      financialYear: selectedYear ?? 2026,
      grossSalary: parseFloat(formState.grossSalary) || 0,
      paygWithheld: parseFloat(formState.paygWithheld) || 0,
      rentalNetResult: rentalNet,
      otherDeductions: parseFloat(formState.otherDeductions) || 0,
      hasHecsDebt: formState.hasHecsDebt,
      hasPrivateHealth: formState.hasPrivateHealth,
      familyStatus: formState.familyStatus,
      dependentChildren: parseInt(formState.dependentChildren) || 0,
      partnerIncome: parseFloat(formState.partnerIncome) || 0,
    }),
    [formState, rentalNet, selectedYear]
  );

  const { data: calculation } = trpc.taxPosition.calculate.useQuery(
    calculationInput,
    {
      enabled:
        !!selectedYear &&
        parseFloat(formState.grossSalary) > 0 &&
        parseFloat(formState.paygWithheld) >= 0,
    }
  );

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      formState.grossSalary !== (profile.grossSalary ?? "") ||
      formState.paygWithheld !== (profile.paygWithheld ?? "") ||
      formState.otherDeductions !== (profile.otherDeductions ?? "0") ||
      formState.hasHecsDebt !== profile.hasHecsDebt ||
      formState.hasPrivateHealth !== profile.hasPrivateHealth ||
      formState.familyStatus !== profile.familyStatus ||
      formState.dependentChildren !== String(profile.dependentChildren) ||
      formState.partnerIncome !== (profile.partnerIncome ?? "")
    );
  }, [formState, profile]);

  const handleSave = () => {
    if (!selectedYear) return;
    saveProfile.mutate({
      financialYear: selectedYear,
      grossSalary: parseFloat(formState.grossSalary) || undefined,
      paygWithheld: parseFloat(formState.paygWithheld) || undefined,
      otherDeductions: parseFloat(formState.otherDeductions) || 0,
      hasHecsDebt: formState.hasHecsDebt,
      hasPrivateHealth: formState.hasPrivateHealth,
      familyStatus: formState.familyStatus,
      dependentChildren: parseInt(formState.dependentChildren) || 0,
      partnerIncome: parseFloat(formState.partnerIncome) || undefined,
      isComplete: true,
    });
  };

  const handleReset = () => {
    if (profile) {
      setFormState({
        grossSalary: profile.grossSalary ?? "",
        paygWithheld: profile.paygWithheld ?? "",
        rentalOverride: null,
        otherDeductions: profile.otherDeductions ?? "0",
        hasHecsDebt: profile.hasHecsDebt,
        hasPrivateHealth: profile.hasPrivateHealth,
        familyStatus: profile.familyStatus as FamilyStatus,
        dependentChildren: String(profile.dependentChildren),
        partnerIncome: profile.partnerIncome ?? "",
      });
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    refetchProfile();
  };

  if (!selectedYear || !supportedYears) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showWizard) {
    return (
      <SetupWizard
        financialYear={selectedYear}
        rentalNetResult={rentalResult?.netResult ?? 0}
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  const fyLabel = `FY ${selectedYear - 1}-${String(selectedYear).slice(-2)}`;
  const showFamilyFields =
    formState.familyStatus === "couple" || formState.familyStatus === "family";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tax Position</h2>
          <p className="text-muted-foreground">
            Your estimated tax outcome for the financial year
          </p>
        </div>
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {supportedYears.map((y) => (
              <SelectItem key={y.year} value={String(y.year)}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Card */}
      {calculation && (
        <Card
          className={
            calculation.isRefund
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {calculation.isRefund ? "Estimated Refund" : "Estimated Owing"}
              </p>
              <p
                className={`text-4xl font-bold ${
                  calculation.isRefund ? "text-green-600" : "text-amber-600"
                }`}
              >
                {formatCurrency(Math.abs(calculation.refundOrOwing))}
              </p>
              {calculation.propertySavings > 0 && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Home className="h-4 w-4" />
                  Your rental properties saved you{" "}
                  {formatCurrency(calculation.propertySavings)} in tax
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Income & Deductions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Income</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grossSalary">Gross salary</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  id="grossSalary"
                  type="number"
                  className="pl-7"
                  value={formState.grossSalary}
                  onChange={(e) =>
                    setFormState({ ...formState, grossSalary: e.target.value })
                  }
                  placeholder="95,000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paygWithheld">PAYG withheld</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  id="paygWithheld"
                  type="number"
                  className="pl-7"
                  value={formState.paygWithheld}
                  onChange={(e) =>
                    setFormState({ ...formState, paygWithheld: e.target.value })
                  }
                  placeholder="22,000"
                />
              </div>
            </div>

            {calculation && (
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxable income</span>
                  <span className="font-medium">
                    {formatCurrency(calculation.taxableIncome)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deductions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deductions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Rental property result</Label>
                <Link
                  href="/reports/tax"
                  className="text-xs text-primary flex items-center gap-1"
                >
                  View breakdown
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7"
                  value={
                    formState.rentalOverride ?? String(rentalResult?.netResult ?? 0)
                  }
                  onChange={(e) =>
                    setFormState({ ...formState, rentalOverride: e.target.value })
                  }
                />
              </div>
              {formState.rentalOverride !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFormState({ ...formState, rentalOverride: null })
                  }
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset to actual
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Based on {rentalResult?.transactionCount ?? 0} transactions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherDeductions">Other deductions</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  id="otherDeductions"
                  type="number"
                  className="pl-7"
                  value={formState.otherDeductions}
                  onChange={(e) =>
                    setFormState({ ...formState, otherDeductions: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Work expenses, donations, income protection, etc.
              </p>
            </div>

            {calculation && (
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total deductions</span>
                  <span className="font-medium">
                    {formatCurrency(calculation.totalDeductions)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tax Calculation */}
      {calculation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tax Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Tax on taxable income</span>
                <span>{formatCurrency(calculation.baseTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Medicare levy (2%)</span>
                <span>{formatCurrency(calculation.medicareLevy)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  Medicare Levy Surcharge
                  {calculation.mlsApplies && (
                    <span className="text-muted-foreground ml-1">
                      (no PHI, income above{" "}
                      {formatCurrency(calculation.mlsThreshold)})
                    </span>
                  )}
                </span>
                <span>{formatCurrency(calculation.medicareLevySurcharge)}</span>
              </div>
              <div className="flex justify-between">
                <span>HECS/HELP repayment</span>
                <span>{formatCurrency(calculation.hecsRepayment)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Total tax liability</span>
                <span>{formatCurrency(calculation.totalTaxLiability)}</span>
              </div>
              <div className="flex justify-between">
                <span>Less: PAYG already paid</span>
                <span className="text-green-600">
                  -{formatCurrency(calculation.paygWithheld)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>
                  {calculation.isRefund ? "ESTIMATED REFUND" : "ESTIMATED OWING"}
                </span>
                <span
                  className={
                    calculation.isRefund ? "text-green-600" : "text-amber-600"
                  }
                >
                  {formatCurrency(Math.abs(calculation.refundOrOwing))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tax Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasHecsDebt"
              checked={formState.hasHecsDebt}
              onCheckedChange={(checked) =>
                setFormState({ ...formState, hasHecsDebt: !!checked })
              }
            />
            <Label htmlFor="hasHecsDebt">I have a HECS/HELP debt</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasPrivateHealth"
              checked={formState.hasPrivateHealth}
              onCheckedChange={(checked) =>
                setFormState({ ...formState, hasPrivateHealth: !!checked })
              }
            />
            <Label htmlFor="hasPrivateHealth">
              I have private hospital cover
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Family status</Label>
            <Select
              value={formState.familyStatus}
              onValueChange={(v) =>
                setFormState({ ...formState, familyStatus: v as FamilyStatus })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="couple">Couple</SelectItem>
                <SelectItem value="family">Family</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showFamilyFields && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dependentChildren">Dependent children</Label>
                <Input
                  id="dependentChildren"
                  type="number"
                  className="w-[100px]"
                  min="0"
                  value={formState.dependentChildren}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      dependentChildren: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnerIncome">Partner&apos;s taxable income</Label>
                <div className="relative w-[200px]">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="partnerIncome"
                    type="number"
                    className="pl-7"
                    value={formState.partnerIncome}
                    onChange={(e) =>
                      setFormState({ ...formState, partnerIncome: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for family MLS threshold only
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Unsaved Changes Bar */}
      {hasChanges && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">You have unsaved changes</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveProfile.isPending}
                >
                  {saveProfile.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save to profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/tax-position/
git commit -m "feat(tax): add tax position page with full breakdown"
```

---

### Task 9: Create Setup Wizard Component

**Files:**
- Create: `src/components/tax-position/SetupWizard.tsx`

**Step 1: Create component**

```typescript
// src/components/tax-position/SetupWizard.tsx

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeft, ArrowRight, Home, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

type FamilyStatus = "single" | "couple" | "family";

interface SetupWizardProps {
  financialYear: number;
  rentalNetResult: number;
  onComplete: () => void;
  onCancel: () => void;
}

interface WizardState {
  grossSalary: string;
  paygWithheld: string;
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  familyStatus: FamilyStatus;
  dependentChildren: string;
  partnerIncome: string;
  otherDeductions: string;
}

const TOTAL_STEPS = 5;

export function SetupWizard({
  financialYear,
  rentalNetResult,
  onComplete,
  onCancel,
}: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    grossSalary: "",
    paygWithheld: "",
    hasHecsDebt: false,
    hasPrivateHealth: true,
    familyStatus: "single",
    dependentChildren: "0",
    partnerIncome: "",
    otherDeductions: "0",
  });

  const saveProfile = trpc.taxPosition.saveProfile.useMutation({
    onSuccess: () => {
      setStep(TOTAL_STEPS + 1); // completion screen
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save profile");
    },
  });

  const { data: calculation } = trpc.taxPosition.calculate.useQuery(
    {
      financialYear,
      grossSalary: parseFloat(state.grossSalary) || 0,
      paygWithheld: parseFloat(state.paygWithheld) || 0,
      rentalNetResult,
      otherDeductions: parseFloat(state.otherDeductions) || 0,
      hasHecsDebt: state.hasHecsDebt,
      hasPrivateHealth: state.hasPrivateHealth,
      familyStatus: state.familyStatus,
      dependentChildren: parseInt(state.dependentChildren) || 0,
      partnerIncome: parseFloat(state.partnerIncome) || 0,
    },
    {
      enabled: step === TOTAL_STEPS + 1, // only on completion
    }
  );

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      // Save profile
      saveProfile.mutate({
        financialYear,
        grossSalary: parseFloat(state.grossSalary) || undefined,
        paygWithheld: parseFloat(state.paygWithheld) || undefined,
        otherDeductions: parseFloat(state.otherDeductions) || 0,
        hasHecsDebt: state.hasHecsDebt,
        hasPrivateHealth: state.hasPrivateHealth,
        familyStatus: state.familyStatus,
        dependentChildren: parseInt(state.dependentChildren) || 0,
        partnerIncome: parseFloat(state.partnerIncome) || undefined,
        isComplete: true,
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const fyLabel = `FY ${financialYear - 1}-${String(financialYear).slice(-2)}`;

  // Completion screen
  if (step > TOTAL_STEPS) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <PartyPopper className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold">Your estimated refund</h3>
              {calculation ? (
                <>
                  <p
                    className={`text-4xl font-bold ${
                      calculation.isRefund ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(calculation.refundOrOwing))}
                  </p>
                  {calculation.propertySavings > 0 && (
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                      <Home className="h-4 w-4" />
                      Your rental properties saved you{" "}
                      {formatCurrency(calculation.propertySavings)} in tax!
                    </p>
                  )}
                  <div className="border-t pt-4 mt-4 text-sm text-left space-y-1">
                    <div className="flex justify-between">
                      <span>Gross salary</span>
                      <span>{formatCurrency(calculation.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rental result</span>
                      <span>
                        {calculation.rentalNetResult < 0 ? "-" : ""}
                        {formatCurrency(Math.abs(calculation.rentalNetResult))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax payable</span>
                      <span>{formatCurrency(calculation.totalTaxLiability)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PAYG paid</span>
                      <span>-{formatCurrency(calculation.paygWithheld)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              )}
              <Button onClick={onComplete} className="w-full mt-4">
                View full breakdown
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Let&apos;s estimate your tax refund</CardTitle>
            <span className="text-sm text-muted-foreground">
              Step {step}/{TOTAL_STEPS}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Gross Salary */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">What&apos;s your annual gross salary?</h3>
                <p className="text-sm text-muted-foreground">
                  Before tax, from your payslip or contract
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7 text-lg"
                  value={state.grossSalary}
                  onChange={(e) =>
                    setState({ ...state, grossSalary: e.target.value })
                  }
                  placeholder="95,000"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: PAYG Withheld */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">How much tax has been withheld this {fyLabel}?</h3>
                <p className="text-sm text-muted-foreground">
                  Check your payslips or estimate: salary × 0.25 is typical
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7 text-lg"
                  value={state.paygWithheld}
                  onChange={(e) =>
                    setState({ ...state, paygWithheld: e.target.value })
                  }
                  placeholder="22,000"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 3: HECS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Do you have a HECS/HELP debt?</h3>
                <p className="text-sm text-muted-foreground">
                  Study loan that gets repaid through your tax return
                </p>
              </div>
              <div className="flex gap-4">
                <Button
                  variant={state.hasHecsDebt ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setState({ ...state, hasHecsDebt: true })}
                >
                  Yes
                </Button>
                <Button
                  variant={!state.hasHecsDebt ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setState({ ...state, hasHecsDebt: false })}
                >
                  No
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Private Health & Family */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Do you have private hospital cover?</h3>
                  <p className="text-sm text-muted-foreground">
                    Avoids Medicare Levy Surcharge for higher incomes
                  </p>
                </div>
                <div className="flex gap-4">
                  <Button
                    variant={state.hasPrivateHealth ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setState({ ...state, hasPrivateHealth: true })}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={!state.hasPrivateHealth ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setState({ ...state, hasPrivateHealth: false })}
                  >
                    No
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">What&apos;s your family status?</h3>
                </div>
                <Select
                  value={state.familyStatus}
                  onValueChange={(v) =>
                    setState({ ...state, familyStatus: v as FamilyStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="couple">Couple</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(state.familyStatus === "couple" ||
                state.familyStatus === "family") && (
                <>
                  <div className="space-y-2">
                    <Label>Dependent children</Label>
                    <Input
                      type="number"
                      min="0"
                      value={state.dependentChildren}
                      onChange={(e) =>
                        setState({ ...state, dependentChildren: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Partner&apos;s taxable income</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        className="pl-7"
                        value={state.partnerIncome}
                        onChange={(e) =>
                          setState({ ...state, partnerIncome: e.target.value })
                        }
                        placeholder="0"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for MLS family threshold only
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 5: Other Deductions */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Any other tax deductions?</h3>
                <p className="text-sm text-muted-foreground">
                  Work expenses, donations, income protection. Enter $0 if unsure.
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7 text-lg"
                  value={state.otherDeductions}
                  onChange={(e) =>
                    setState({ ...state, otherDeductions: e.target.value })
                  }
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <div>
              {step > 1 ? (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleNext} disabled={saveProfile.isPending}>
                {saveProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === TOTAL_STEPS ? (
                  "Calculate"
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Create index export**

```typescript
// src/components/tax-position/index.ts

export { TaxPositionCard } from "./TaxPositionCard";
export { SetupWizard } from "./SetupWizard";
```

**Step 3: Commit**

```bash
git add src/components/tax-position/
git commit -m "feat(tax): add setup wizard component"
```

---

## Phase 3: Final Integration

### Task 10: Add Navigation Link

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (or wherever nav is defined)

**Step 1: Add link to reports section**

Find the reports navigation items and add:

```typescript
{ href: "/reports/tax-position", label: "Tax Position", icon: Calculator },
```

**Step 2: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(tax): add Tax Position to navigation"
```

---

### Task 11: Final Testing & Polish

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Manual testing checklist**

- [ ] Dashboard card shows "Set up in 2 min" when no profile
- [ ] Setup wizard flows through all 5 steps
- [ ] Completion screen shows calculated refund
- [ ] Dashboard card shows refund/owing after setup
- [ ] Tax position page shows full breakdown
- [ ] Editing values updates calculation live
- [ ] Save/Reset buttons work correctly
- [ ] FY selector changes calculations
- [ ] Rental override works and can be reset

**Step 3: Run linting**

```bash
npm run lint
```

**Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix(tax): address linting issues"
```

---

### Task 12: Create PR and Merge

**Step 1: Push branch**

```bash
git push -u origin feature/tax-position-calculator
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: add Tax Position Calculator" --body "$(cat <<'EOF'
## Summary
- Add comprehensive tax position calculator showing estimated refund/owing
- Dashboard card with property savings highlight
- Dedicated page with full breakdown and what-if editing
- 5-step setup wizard for new users
- Support for HECS, MLS, Medicare levy calculations
- Hardcoded Australian tax tables for FY2024-2026

## Test plan
- [ ] Dashboard card shows "Set up" prompt for new users
- [ ] Setup wizard completes successfully
- [ ] Tax calculations match expected values
- [ ] What-if editing updates in real-time
- [ ] Save/Reset profile functionality works
- [ ] FY selector loads correct tax rates

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Merge PR**

```bash
gh pr merge --squash
```

---

## Summary

| Phase | Tasks | Commits |
|-------|-------|---------|
| Data Layer | Tax tables, Schema, Service, Tests, Router | 5 |
| UI Components | Card, Page, Wizard | 4 |
| Integration | Navigation, Testing, PR | 3 |
| **Total** | **12 tasks** | **~12 commits** |
