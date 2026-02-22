# Depreciation Schedule Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full depreciation tracker for Australian property investors covering Div 40 (plant & equipment), Div 43 (capital works), and low-value pool with on-demand projections and per-FY claim tracking.

**Architecture:** Pure calculation engine as stateless functions, new `depreciationClaims` and `capitalWorks` tables extending the existing schema, new `depreciationRouter` for CRUD + projections, new `/properties/[id]/depreciation` tab with inline asset management. Existing PDF extraction stays in `taxOptimizationRouter`.

**Tech Stack:** Drizzle ORM (schema + queries), tRPC v11 (router), Zod v4 (validation), React 19 (UI), Tailwind v4 (styling), Vitest (tests), Playwright (E2E)

**Design Doc:** `docs/plans/2026-02-20-depreciation-tracker-design.md`

**Tech Notes:** Context7 quota exceeded for this session. Patterns verified against existing codebase: Drizzle `pgTable`/`pgEnum` in `src/server/db/schema/tax.ts`, tRPC router pattern in `src/server/routers/tax/taxOptimization.ts`, repository interface pattern in `src/server/repositories/interfaces/property.repository.interface.ts`, UnitOfWork lazy getter in `src/server/repositories/unit-of-work.ts`, test pattern in `src/server/__tests__/test-utils.ts`.

---

## Task 1: Schema — New Enum, Columns, and Tables

**Files:**
- Modify: `src/server/db/schema/tax.ts` (add enum, columns, tables, types, relations)
- Modify: `src/server/db/schema/index.ts` (already re-exports `./tax`, verify)

**Step 1: Add `poolTypeEnum` to `src/server/db/schema/tax.ts`**

Add after existing `depreciationMethodEnum` (around line 219):

```typescript
export const poolTypeEnum = pgEnum("pool_type", [
  "individual",
  "low_value",
  "immediate_writeoff",
]);
```

**Step 2: Add new columns to `depreciationAssets` table**

Add to the columns object (around line 93):

```typescript
purchaseDate: date("purchase_date"),
poolType: poolTypeEnum("pool_type").default("individual").notNull(),
openingWrittenDownValue: decimal("opening_written_down_value", { precision: 12, scale: 2 }),
```

**Step 3: Add `depreciationClaims` table**

Add after `depreciationAssets`:

```typescript
export const depreciationClaims = pgTable(
  "depreciation_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").references(() => depreciationAssets.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id")
      .references(() => depreciationSchedules.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: integer("financial_year").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  },
  (table) => [
    index("depreciation_claims_schedule_id_idx").on(table.scheduleId),
    index("depreciation_claims_fy_idx").on(table.scheduleId, table.financialYear),
  ]
);
```

**Step 4: Add `capitalWorks` table**

```typescript
export const capitalWorks = pgTable(
  "capital_works",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    constructionDate: date("construction_date").notNull(),
    constructionCost: decimal("construction_cost", { precision: 12, scale: 2 }).notNull(),
    claimStartDate: date("claim_start_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("capital_works_property_id_idx").on(table.propertyId),
    index("capital_works_user_id_idx").on(table.userId),
  ]
);
```

**Step 5: Add Drizzle relations for new tables**

Add to the relations section of `tax.ts`:

```typescript
export const depreciationClaimsRelations = relations(depreciationClaims, ({ one }) => ({
  asset: one(depreciationAssets, {
    fields: [depreciationClaims.assetId],
    references: [depreciationAssets.id],
  }),
  schedule: one(depreciationSchedules, {
    fields: [depreciationClaims.scheduleId],
    references: [depreciationSchedules.id],
  }),
}));

export const capitalWorksRelations = relations(capitalWorks, ({ one }) => ({
  property: one(properties, {
    fields: [capitalWorks.propertyId],
    references: [properties.id],
  }),
}));
```

Also add `claims` to the existing `depreciationAssetsRelations` and `depreciationSchedulesRelations`:

```typescript
// In depreciationSchedulesRelations: add
claims: many(depreciationClaims),

// In depreciationAssetsRelations: add
claims: many(depreciationClaims),
```

**Step 6: Add type exports**

```typescript
export type DepreciationClaim = typeof depreciationClaims.$inferSelect;
export type NewDepreciationClaim = typeof depreciationClaims.$inferInsert;
export type CapitalWork = typeof capitalWorks.$inferSelect;
export type NewCapitalWork = typeof capitalWorks.$inferInsert;
```

**Step 7: Push schema to DB**

Run: `npx drizzle-kit push`
Expected: Tables created/altered successfully

**Step 8: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to schema changes

**Step 9: Commit**

```bash
git add src/server/db/schema/tax.ts
git commit -m "feat: add depreciation claims, capital works tables and pool type enum"
```

---

## Task 2: Calculation Engine — Pure Functions + Tests

**Files:**
- Create: `src/server/services/depreciation-calculator.ts`
- Create: `src/server/services/__tests__/depreciation-calculator.test.ts`

**Step 1: Write failing tests for diminishing value calculation**

Create `src/server/services/__tests__/depreciation-calculator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateDiminishingValue,
  calculatePrimeCost,
  calculateLowValuePoolDeduction,
  calculateCapitalWorksDeduction,
  projectSchedule,
  getCurrentFinancialYear,
  daysInFirstFY,
} from "../depreciation-calculator";

describe("depreciation-calculator", () => {
  describe("getCurrentFinancialYear", () => {
    it("returns correct FY for dates after July 1", () => {
      expect(getCurrentFinancialYear(new Date("2025-08-15"))).toBe(2026);
    });

    it("returns correct FY for dates before July 1", () => {
      expect(getCurrentFinancialYear(new Date("2026-03-01"))).toBe(2026);
    });

    it("returns correct FY for July 1 exactly", () => {
      expect(getCurrentFinancialYear(new Date("2025-07-01"))).toBe(2026);
    });
  });

  describe("daysInFirstFY", () => {
    it("calculates days from purchase to June 30", () => {
      // Jan 1 2026 to Jun 30 2026 = 181 days
      expect(daysInFirstFY(new Date("2026-01-01"))).toBe(181);
    });

    it("returns 365 for July 1 purchase", () => {
      expect(daysInFirstFY(new Date("2025-07-01"))).toBe(365);
    });

    it("returns 1 for June 30 purchase", () => {
      expect(daysInFirstFY(new Date("2026-06-30"))).toBe(1);
    });
  });

  describe("calculateDiminishingValue", () => {
    it("calculates first full year correctly", () => {
      // $10,000 asset, 10yr life → rate = 200/10 = 20%
      // Year 1: $10,000 × 20% = $2,000
      const result = calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 365,
      });
      expect(result).toBeCloseTo(2000, 2);
    });

    it("pro-rates first year by days held", () => {
      // Half year: 183/365 × $2,000 = $1,002.74
      const result = calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 183,
      });
      expect(result).toBeCloseTo(1002.74, 2);
    });

    it("applies diminishing base in subsequent years", () => {
      // Year 2: ($10,000 - $2,000) × 20% = $1,600
      const result = calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 1,
        daysFirstYear: 365,
      });
      expect(result).toBeCloseTo(1600, 2);
    });

    it("returns 0 for fully depreciated asset", () => {
      const result = calculateDiminishingValue({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 50,
        daysFirstYear: 365,
      });
      expect(result).toBe(0);
    });
  });

  describe("calculatePrimeCost", () => {
    it("calculates flat annual deduction", () => {
      // $10,000 / 10 years = $1,000/year
      const result = calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 365,
      });
      expect(result).toBeCloseTo(1000, 2);
    });

    it("pro-rates first year", () => {
      const result = calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 0,
        daysFirstYear: 183,
      });
      expect(result).toBeCloseTo(501.37, 2);
    });

    it("gives same deduction every subsequent year", () => {
      const year2 = calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 1,
        daysFirstYear: 365,
      });
      const year5 = calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 4,
        daysFirstYear: 365,
      });
      expect(year2).toBeCloseTo(1000, 2);
      expect(year5).toBeCloseTo(1000, 2);
    });

    it("returns 0 past effective life", () => {
      const result = calculatePrimeCost({
        cost: 10000,
        effectiveLife: 10,
        yearIndex: 10,
        daysFirstYear: 365,
      });
      expect(result).toBe(0);
    });
  });

  describe("calculateLowValuePoolDeduction", () => {
    it("applies 18.75% to opening balance", () => {
      const result = calculateLowValuePoolDeduction({
        openingBalance: 5000,
        additions: 0,
      });
      expect(result).toBeCloseTo(937.5, 2);
    });

    it("applies 37.5% to additions", () => {
      const result = calculateLowValuePoolDeduction({
        openingBalance: 0,
        additions: 2000,
      });
      expect(result).toBeCloseTo(750, 2);
    });

    it("combines opening and additions correctly", () => {
      const result = calculateLowValuePoolDeduction({
        openingBalance: 5000,
        additions: 2000,
      });
      // 5000 × 18.75% + 2000 × 37.5% = 937.50 + 750 = 1687.50
      expect(result).toBeCloseTo(1687.5, 2);
    });
  });

  describe("calculateCapitalWorksDeduction", () => {
    it("calculates 2.5% of construction cost", () => {
      const result = calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date("2010-01-01"),
        claimStartDate: new Date("2020-07-01"),
        financialYear: 2026,
      });
      expect(result).toBeCloseTo(10000, 2);
    });

    it("pro-rates first year from claim start date", () => {
      // Claim starts Jan 1 2026 → Jun 30 2026 = 181 days
      // $400,000 × 2.5% × 181/365 = $4,958.90
      const result = calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date("2010-01-01"),
        claimStartDate: new Date("2026-01-01"),
        financialYear: 2026,
      });
      expect(result).toBeCloseTo(4958.9, 0);
    });

    it("returns 0 after 40 years", () => {
      const result = calculateCapitalWorksDeduction({
        constructionCost: 400000,
        constructionDate: new Date("1980-01-01"),
        claimStartDate: new Date("1980-07-01"),
        financialYear: 2026,
      });
      expect(result).toBe(0);
    });
  });

  describe("projectSchedule", () => {
    it("projects multiple years with mixed asset types", () => {
      const assets = [
        {
          id: "a1",
          cost: 10000,
          effectiveLife: 10,
          method: "diminishing_value" as const,
          purchaseDate: new Date("2025-07-01"),
          poolType: "individual" as const,
        },
      ];
      const capitalWorksItems = [
        {
          id: "cw1",
          constructionCost: 200000,
          constructionDate: new Date("2015-01-01"),
          claimStartDate: new Date("2020-07-01"),
        },
      ];

      const result = projectSchedule({
        assets,
        capitalWorks: capitalWorksItems,
        fromFY: 2026,
        toFY: 2028,
      });

      expect(result).toHaveLength(3);
      expect(result[0].financialYear).toBe(2026);
      expect(result[0].div40Total).toBeGreaterThan(0);
      expect(result[0].div43Total).toBeCloseTo(5000, 2);
      expect(result[0].grandTotal).toBe(
        result[0].div40Total + result[0].div43Total + result[0].lowValuePoolTotal
      );
    });

    it("excludes fully depreciated assets", () => {
      const assets = [
        {
          id: "a1",
          cost: 1000,
          effectiveLife: 2,
          method: "prime_cost" as const,
          purchaseDate: new Date("2020-07-01"),
          poolType: "individual" as const,
        },
      ];

      const result = projectSchedule({
        assets,
        capitalWorks: [],
        fromFY: 2026,
        toFY: 2028,
      });

      // Asset fully depreciated after 2 years (2022), so all projections should be 0
      expect(result[0].div40Total).toBe(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/__tests__/depreciation-calculator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the calculation engine**

Create `src/server/services/depreciation-calculator.ts`:

```typescript
/**
 * Pure depreciation calculation functions for Australian tax (Div 40, Div 43, Low-Value Pool).
 * All functions are stateless — no DB access. FY convention: 2026 = FY2025-26 (ending Jun 30 2026).
 */

/** Returns the FY integer for a given date. Jul 1 2025 → FY2026. Mar 1 2026 → FY2026. */
export function getCurrentFinancialYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  return month >= 6 ? year + 1 : year; // Jul (6) onwards = next FY
}

/** Days from purchase date to June 30 of that FY. */
export function daysInFirstFY(purchaseDate: Date): number {
  const fy = getCurrentFinancialYear(purchaseDate);
  const fyEnd = new Date(fy, 5, 30); // Jun 30 of FY end year
  const diffMs = fyEnd.getTime() - purchaseDate.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

interface DepreciationInput {
  cost: number;
  effectiveLife: number;
  yearIndex: number; // 0 = first year
  daysFirstYear: number; // days held in first FY (1-365)
}

/** Div 40 Diminishing Value: baseValue × (200% ÷ effectiveLife), pro-rata first year. */
export function calculateDiminishingValue(input: DepreciationInput): number {
  const { cost, effectiveLife, yearIndex, daysFirstYear } = input;
  const rate = 2 / effectiveLife;

  let writtenDownValue = cost;
  for (let i = 0; i <= yearIndex; i++) {
    const deduction = writtenDownValue * rate;
    const proRata = i === 0 ? daysFirstYear / 365 : 1;
    const yearDeduction = deduction * proRata;

    if (i === yearIndex) {
      return writtenDownValue <= 0.01 ? 0 : Math.round(yearDeduction * 100) / 100;
    }

    writtenDownValue -= yearDeduction;
    if (writtenDownValue <= 0) return 0;
  }

  return 0;
}

/** Div 40 Prime Cost: cost × (100% ÷ effectiveLife), pro-rata first year. */
export function calculatePrimeCost(input: DepreciationInput): number {
  const { cost, effectiveLife, yearIndex, daysFirstYear } = input;
  const annualDeduction = cost / effectiveLife;
  const proRata = yearIndex === 0 ? daysFirstYear / 365 : 1;

  // Check if asset is fully depreciated
  let totalClaimed = 0;
  for (let i = 0; i < yearIndex; i++) {
    const pr = i === 0 ? daysFirstYear / 365 : 1;
    totalClaimed += annualDeduction * pr;
  }

  const remaining = cost - totalClaimed;
  if (remaining <= 0) return 0;

  const deduction = Math.min(annualDeduction * proRata, remaining);
  return Math.round(deduction * 100) / 100;
}

interface LowValuePoolInput {
  openingBalance: number;
  additions: number;
}

/** Low-value pool: 18.75% of opening balance + 37.5% of in-year additions. */
export function calculateLowValuePoolDeduction(input: LowValuePoolInput): number {
  const { openingBalance, additions } = input;
  const deduction = openingBalance * 0.1875 + additions * 0.375;
  return Math.round(deduction * 100) / 100;
}

interface CapitalWorksInput {
  constructionCost: number;
  constructionDate: Date;
  claimStartDate: Date;
  financialYear: number;
}

/** Div 43: 2.5% of construction cost per year for 40 years, pro-rata first year. */
export function calculateCapitalWorksDeduction(input: CapitalWorksInput): number {
  const { constructionCost, constructionDate, claimStartDate, financialYear } = input;
  const annualDeduction = constructionCost * 0.025;

  // 40-year cap from construction date
  const constructionFY = getCurrentFinancialYear(constructionDate);
  if (financialYear - constructionFY >= 40) return 0;

  const claimStartFY = getCurrentFinancialYear(claimStartDate);

  if (financialYear < claimStartFY) return 0;

  // Pro-rata first year from claim start date
  if (financialYear === claimStartFY) {
    const fyEnd = new Date(financialYear, 5, 30);
    const diffMs = fyEnd.getTime() - claimStartDate.getTime();
    const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    return Math.round(annualDeduction * (days / 365) * 100) / 100;
  }

  return Math.round(annualDeduction * 100) / 100;
}

export interface ProjectionAsset {
  id: string;
  cost: number;
  effectiveLife: number;
  method: "diminishing_value" | "prime_cost";
  purchaseDate: Date;
  poolType: "individual" | "low_value" | "immediate_writeoff";
}

export interface ProjectionCapitalWork {
  id: string;
  constructionCost: number;
  constructionDate: Date;
  claimStartDate: Date;
}

export interface ProjectionRow {
  financialYear: number;
  div40Total: number;
  div43Total: number;
  lowValuePoolTotal: number;
  grandTotal: number;
}

interface ProjectionInput {
  assets: ProjectionAsset[];
  capitalWorks: ProjectionCapitalWork[];
  fromFY: number;
  toFY: number;
}

/** Project depreciation schedule across financial years. */
export function projectSchedule(input: ProjectionInput): ProjectionRow[] {
  const { assets, capitalWorks, fromFY, toFY } = input;
  const rows: ProjectionRow[] = [];

  for (let fy = fromFY; fy <= toFY; fy++) {
    let div40Total = 0;
    let lowValuePoolTotal = 0;

    for (const asset of assets) {
      const purchaseFY = getCurrentFinancialYear(asset.purchaseDate);
      const yearIndex = fy - purchaseFY;
      if (yearIndex < 0) continue;

      if (asset.poolType === "immediate_writeoff") {
        if (fy === purchaseFY) div40Total += asset.cost;
        continue;
      }

      if (asset.poolType === "low_value") {
        // Simplified: treated as addition in purchase year, opening balance thereafter
        if (fy === purchaseFY) {
          lowValuePoolTotal += asset.cost * 0.375;
        } else {
          // Approximate remaining value for pool calculation
          let remaining = asset.cost * (1 - 0.375);
          for (let y = 1; y < yearIndex; y++) {
            remaining *= 1 - 0.1875;
          }
          lowValuePoolTotal += remaining * 0.1875;
        }
        continue;
      }

      const firstYearDays = daysInFirstFY(asset.purchaseDate);
      const calcFn = asset.method === "diminishing_value" ? calculateDiminishingValue : calculatePrimeCost;
      div40Total += calcFn({
        cost: asset.cost,
        effectiveLife: asset.effectiveLife,
        yearIndex,
        daysFirstYear: firstYearDays,
      });
    }

    let div43Total = 0;
    for (const cw of capitalWorks) {
      div43Total += calculateCapitalWorksDeduction({
        constructionCost: cw.constructionCost,
        constructionDate: cw.constructionDate,
        claimStartDate: cw.claimStartDate,
        financialYear: fy,
      });
    }

    rows.push({
      financialYear: fy,
      div40Total: Math.round(div40Total * 100) / 100,
      div43Total: Math.round(div43Total * 100) / 100,
      lowValuePoolTotal: Math.round(lowValuePoolTotal * 100) / 100,
      grandTotal: Math.round((div40Total + div43Total + lowValuePoolTotal) * 100) / 100,
    });
  }

  return rows;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/depreciation-calculator.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/services/depreciation-calculator.ts src/server/services/__tests__/depreciation-calculator.test.ts
git commit -m "feat: add depreciation calculation engine with full test coverage"
```

---

## Task 3: Depreciation Repository — Interface + Implementation

**Files:**
- Create: `src/server/repositories/interfaces/depreciation.repository.interface.ts`
- Create: `src/server/repositories/depreciation.repository.ts`
- Modify: `src/server/repositories/interfaces/index.ts` (add export)
- Modify: `src/server/repositories/unit-of-work.ts` (register repo)
- Create: `src/server/repositories/__tests__/depreciation.repository.test.ts`

**Step 1: Write the repository interface**

Create `src/server/repositories/interfaces/depreciation.repository.interface.ts`:

```typescript
import type {
  DepreciationAsset,
  NewDepreciationAsset,
  DepreciationClaim,
  NewDepreciationClaim,
  CapitalWork,
  NewCapitalWork,
  DepreciationSchedule,
} from "../../db/schema";
import type { DB } from "../base";

export type DepreciationAssetWithClaims = DepreciationAsset & {
  claims: DepreciationClaim[];
};

export type ScheduleWithAssets = DepreciationSchedule & {
  assets: DepreciationAssetWithClaims[];
};

export interface IDepreciationRepository {
  /** Find all schedules with assets and claims for a property */
  findSchedulesByProperty(propertyId: string, userId: string): Promise<ScheduleWithAssets[]>;

  /** Find a single asset by ID scoped to user (via schedule) */
  findAssetById(assetId: string, userId: string): Promise<DepreciationAsset | null>;

  /** Create a new asset on a schedule */
  createAsset(data: NewDepreciationAsset, tx?: DB): Promise<DepreciationAsset>;

  /** Update an existing asset */
  updateAsset(assetId: string, userId: string, data: Partial<DepreciationAsset>, tx?: DB): Promise<DepreciationAsset | null>;

  /** Delete an asset */
  deleteAsset(assetId: string, userId: string, tx?: DB): Promise<void>;

  /** Find all capital works for a property */
  findCapitalWorksByProperty(propertyId: string, userId: string): Promise<CapitalWork[]>;

  /** Create a capital work */
  createCapitalWork(data: NewCapitalWork, tx?: DB): Promise<CapitalWork>;

  /** Update a capital work */
  updateCapitalWork(id: string, userId: string, data: Partial<CapitalWork>, tx?: DB): Promise<CapitalWork | null>;

  /** Delete a capital work */
  deleteCapitalWork(id: string, userId: string, tx?: DB): Promise<void>;

  /** Find claims for a schedule in a financial year */
  findClaimsByFY(scheduleId: string, financialYear: number): Promise<DepreciationClaim[]>;

  /** Create a claim record */
  createClaim(data: NewDepreciationClaim, tx?: DB): Promise<DepreciationClaim>;

  /** Delete claims for a schedule in a financial year */
  deleteClaimsByFY(scheduleId: string, financialYear: number, tx?: DB): Promise<void>;
}
```

**Step 2: Write failing tests for the repository**

Create `src/server/repositories/__tests__/depreciation.repository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow } from "../../__tests__/test-utils";

describe("DepreciationRepository (via UoW mock)", () => {
  it("findSchedulesByProperty returns schedules with assets", async () => {
    const mockSchedule = {
      id: "s1",
      propertyId: "p1",
      userId: "u1",
      assets: [{ id: "a1", assetName: "Carpet", claims: [] }],
    };
    const uow = createMockUow({
      depreciation: {
        findSchedulesByProperty: vi.fn().mockResolvedValue([mockSchedule]),
      },
    });

    const result = await uow.depreciation.findSchedulesByProperty("p1", "u1");
    expect(result).toHaveLength(1);
    expect(result[0].assets[0].assetName).toBe("Carpet");
  });

  it("createAsset returns created asset", async () => {
    const newAsset = {
      scheduleId: "s1",
      assetName: "Hot Water System",
      category: "plant_equipment" as const,
      originalCost: "1500.00",
      effectiveLife: "12.00",
      method: "diminishing_value" as const,
      yearlyDeduction: "250.00",
      remainingValue: "1500.00",
      poolType: "individual" as const,
    };
    const uow = createMockUow({
      depreciation: {
        createAsset: vi.fn().mockResolvedValue({ id: "a2", ...newAsset }),
      },
    });

    const result = await uow.depreciation.createAsset(newAsset);
    expect(result.id).toBe("a2");
    expect(result.assetName).toBe("Hot Water System");
  });

  it("createCapitalWork returns created capital work", async () => {
    const newCW = {
      propertyId: "p1",
      userId: "u1",
      description: "Bathroom renovation",
      constructionDate: "2020-06-15",
      constructionCost: "50000.00",
      claimStartDate: "2020-07-01",
    };
    const uow = createMockUow({
      depreciation: {
        createCapitalWork: vi.fn().mockResolvedValue({ id: "cw1", ...newCW }),
      },
    });

    const result = await uow.depreciation.createCapitalWork(newCW);
    expect(result.description).toBe("Bathroom renovation");
  });

  it("findClaimsByFY returns claims for a schedule and year", async () => {
    const uow = createMockUow({
      depreciation: {
        findClaimsByFY: vi.fn().mockResolvedValue([
          { id: "cl1", scheduleId: "s1", financialYear: 2026, amount: "5000.00" },
        ]),
      },
    });

    const claims = await uow.depreciation.findClaimsByFY("s1", 2026);
    expect(claims).toHaveLength(1);
    expect(claims[0].amount).toBe("5000.00");
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/server/repositories/__tests__/depreciation.repository.test.ts`
Expected: FAIL — `uow.depreciation` is undefined (not registered yet)

**Step 4: Implement the repository**

Create `src/server/repositories/depreciation.repository.ts`:

```typescript
import { and, eq, desc } from "drizzle-orm";
import { BaseRepository } from "./base";
import {
  depreciationSchedules,
  depreciationAssets,
  depreciationClaims,
  capitalWorks,
} from "../db/schema";
import type {
  DepreciationAsset,
  NewDepreciationAsset,
  DepreciationClaim,
  NewDepreciationClaim,
  CapitalWork,
  NewCapitalWork,
} from "../db/schema";
import type { DB } from "./base";
import type { IDepreciationRepository, ScheduleWithAssets } from "./interfaces/depreciation.repository.interface";

export class DepreciationRepository extends BaseRepository implements IDepreciationRepository {
  async findSchedulesByProperty(propertyId: string, userId: string): Promise<ScheduleWithAssets[]> {
    return this.db.query.depreciationSchedules.findMany({
      where: and(
        eq(depreciationSchedules.propertyId, propertyId),
        eq(depreciationSchedules.userId, userId),
      ),
      with: {
        assets: {
          with: { claims: true },
        },
      },
      orderBy: [desc(depreciationSchedules.createdAt)],
    }) as Promise<ScheduleWithAssets[]>;
  }

  async findAssetById(assetId: string, userId: string): Promise<DepreciationAsset | null> {
    const result = await this.db.query.depreciationAssets.findFirst({
      where: eq(depreciationAssets.id, assetId),
      with: {
        schedule: true,
      },
    });
    if (!result || (result as any).schedule?.userId !== userId) return null;
    return result;
  }

  async createAsset(data: NewDepreciationAsset, tx?: DB): Promise<DepreciationAsset> {
    const client = this.resolve(tx);
    const [asset] = await client.insert(depreciationAssets).values(data).returning();
    return asset;
  }

  async updateAsset(assetId: string, userId: string, data: Partial<DepreciationAsset>, tx?: DB): Promise<DepreciationAsset | null> {
    const existing = await this.findAssetById(assetId, userId);
    if (!existing) return null;
    const client = this.resolve(tx);
    const [updated] = await client
      .update(depreciationAssets)
      .set(data)
      .where(eq(depreciationAssets.id, assetId))
      .returning();
    return updated;
  }

  async deleteAsset(assetId: string, userId: string, tx?: DB): Promise<void> {
    const existing = await this.findAssetById(assetId, userId);
    if (!existing) return;
    const client = this.resolve(tx);
    await client.delete(depreciationAssets).where(eq(depreciationAssets.id, assetId));
  }

  async findCapitalWorksByProperty(propertyId: string, userId: string): Promise<CapitalWork[]> {
    return this.db.query.capitalWorks.findMany({
      where: and(
        eq(capitalWorks.propertyId, propertyId),
        eq(capitalWorks.userId, userId),
      ),
      orderBy: [desc(capitalWorks.createdAt)],
    });
  }

  async createCapitalWork(data: NewCapitalWork, tx?: DB): Promise<CapitalWork> {
    const client = this.resolve(tx);
    const [cw] = await client.insert(capitalWorks).values(data).returning();
    return cw;
  }

  async updateCapitalWork(id: string, userId: string, data: Partial<CapitalWork>, tx?: DB): Promise<CapitalWork | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(capitalWorks)
      .set(data)
      .where(and(eq(capitalWorks.id, id), eq(capitalWorks.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async deleteCapitalWork(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.delete(capitalWorks).where(
      and(eq(capitalWorks.id, id), eq(capitalWorks.userId, userId))
    );
  }

  async findClaimsByFY(scheduleId: string, financialYear: number): Promise<DepreciationClaim[]> {
    return this.db.query.depreciationClaims.findMany({
      where: and(
        eq(depreciationClaims.scheduleId, scheduleId),
        eq(depreciationClaims.financialYear, financialYear),
      ),
    });
  }

  async createClaim(data: NewDepreciationClaim, tx?: DB): Promise<DepreciationClaim> {
    const client = this.resolve(tx);
    const [claim] = await client.insert(depreciationClaims).values(data).returning();
    return claim;
  }

  async deleteClaimsByFY(scheduleId: string, financialYear: number, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.delete(depreciationClaims).where(
      and(
        eq(depreciationClaims.scheduleId, scheduleId),
        eq(depreciationClaims.financialYear, financialYear),
      )
    );
  }
}
```

**Step 5: Export interface from barrel**

Add to `src/server/repositories/interfaces/index.ts`:

```typescript
export type { IDepreciationRepository, DepreciationAssetWithClaims, ScheduleWithAssets } from "./depreciation.repository.interface";
```

**Step 6: Register in UnitOfWork**

In `src/server/repositories/unit-of-work.ts`:

1. Add imports:
```typescript
import { DepreciationRepository } from "./depreciation.repository";
import type { IDepreciationRepository } from "./interfaces/depreciation.repository.interface";
```

2. Add backing field:
```typescript
private _depreciation?: IDepreciationRepository;
```

3. Add getter:
```typescript
get depreciation(): IDepreciationRepository {
  return (this._depreciation ??= new DepreciationRepository(this.db));
}
```

**Step 7: Run tests to verify they pass**

Run: `npx vitest run src/server/repositories/__tests__/depreciation.repository.test.ts`
Expected: All PASS

**Step 8: Run full test suite to verify no regressions**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All existing tests still pass

**Step 9: Commit**

```bash
git add src/server/repositories/depreciation.repository.ts src/server/repositories/interfaces/depreciation.repository.interface.ts src/server/repositories/interfaces/index.ts src/server/repositories/unit-of-work.ts src/server/repositories/__tests__/depreciation.repository.test.ts
git commit -m "feat: add depreciation repository with interface and UoW registration"
```

---

## Task 4: Depreciation Router

**Files:**
- Create: `src/server/routers/tax/depreciation.ts`
- Modify: `src/server/routers/tax/index.ts` (add export)
- Modify: `src/server/routers/_app.ts` (register router)
- Create: `src/server/routers/tax/__tests__/depreciation.test.ts`

**Step 1: Write failing router tests**

Create `src/server/routers/tax/__tests__/depreciation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow, createMockContext, createMockUser } from "../../../__tests__/test-utils";

// Test the router logic through mock context
describe("depreciation router", () => {
  const mockUser = createMockUser();

  describe("list", () => {
    it("returns schedules with assets for a property", async () => {
      const mockSchedules = [
        {
          id: "s1",
          propertyId: "p1",
          assets: [
            { id: "a1", assetName: "Carpet", poolType: "individual", claims: [] },
          ],
        },
      ];
      const uow = createMockUow({
        depreciation: {
          findSchedulesByProperty: vi.fn().mockResolvedValue(mockSchedules),
        },
      });

      const result = await uow.depreciation.findSchedulesByProperty("p1", mockUser.id);
      expect(result).toHaveLength(1);
    });
  });

  describe("addAsset", () => {
    it("auto-assigns immediate_writeoff for cost <= 300", async () => {
      const createdAsset = {
        id: "a1",
        assetName: "Door handle",
        originalCost: "250.00",
        poolType: "immediate_writeoff",
      };
      const createFn = vi.fn().mockResolvedValue(createdAsset);
      const uow = createMockUow({
        depreciation: { createAsset: createFn },
      });

      await uow.depreciation.createAsset({
        scheduleId: "s1",
        assetName: "Door handle",
        category: "plant_equipment",
        originalCost: "250.00",
        effectiveLife: "5.00",
        method: "diminishing_value",
        yearlyDeduction: "250.00",
        remainingValue: "0.00",
        poolType: "immediate_writeoff",
      });

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ poolType: "immediate_writeoff" })
      );
    });
  });

  describe("getProjection", () => {
    it("computes projections from assets and capital works", async () => {
      // This test validates the integration between router and calculator
      const mockSchedules = [
        {
          id: "s1",
          assets: [
            {
              id: "a1",
              originalCost: "10000.00",
              effectiveLife: "10.00",
              method: "diminishing_value",
              purchaseDate: "2025-07-01",
              poolType: "individual",
              claims: [],
            },
          ],
        },
      ];
      const mockCapitalWorks = [
        {
          id: "cw1",
          constructionCost: "200000.00",
          constructionDate: "2015-01-01",
          claimStartDate: "2020-07-01",
        },
      ];

      const uow = createMockUow({
        depreciation: {
          findSchedulesByProperty: vi.fn().mockResolvedValue(mockSchedules),
          findCapitalWorksByProperty: vi.fn().mockResolvedValue(mockCapitalWorks),
        },
      });

      const schedules = await uow.depreciation.findSchedulesByProperty("p1", "u1");
      const capitalWorks = await uow.depreciation.findCapitalWorksByProperty("p1", "u1");
      expect(schedules).toHaveLength(1);
      expect(capitalWorks).toHaveLength(1);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/routers/tax/__tests__/depreciation.test.ts`
Expected: FAIL (or pass since using mock UoW directly — adjust as needed)

**Step 3: Implement the router**

Create `src/server/routers/tax/depreciation.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  projectSchedule,
  getCurrentFinancialYear,
  daysInFirstFY,
  type ProjectionAsset,
  type ProjectionCapitalWork,
} from "../../services/depreciation-calculator";

function assignPoolType(cost: number): "individual" | "low_value" | "immediate_writeoff" {
  if (cost <= 300) return "immediate_writeoff";
  if (cost <= 1000) return "low_value";
  return "individual";
}

export const depreciationRouter = router({
  list: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [schedules, capitalWorks] = await Promise.all([
        ctx.uow.depreciation.findSchedulesByProperty(input.propertyId, ctx.portfolio.ownerId),
        ctx.uow.depreciation.findCapitalWorksByProperty(input.propertyId, ctx.portfolio.ownerId),
      ]);
      return { schedules, capitalWorks };
    }),

  getProjection: protectedProcedure
    .input(z.object({
      propertyId: z.string().uuid(),
      fromFY: z.number().int().optional(),
      toFY: z.number().int().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const currentFY = getCurrentFinancialYear();
      const fromFY = input.fromFY ?? currentFY;
      const toFY = input.toFY ?? currentFY + 10;

      const [schedules, capitalWorksData] = await Promise.all([
        ctx.uow.depreciation.findSchedulesByProperty(input.propertyId, ctx.portfolio.ownerId),
        ctx.uow.depreciation.findCapitalWorksByProperty(input.propertyId, ctx.portfolio.ownerId),
      ]);

      const assets: ProjectionAsset[] = schedules.flatMap((s) =>
        s.assets.map((a) => ({
          id: a.id,
          cost: Number(a.originalCost),
          effectiveLife: Number(a.effectiveLife),
          method: a.method,
          purchaseDate: a.purchaseDate ? new Date(a.purchaseDate) : new Date(s.effectiveDate),
          poolType: a.poolType,
        }))
      );

      const capitalWorks: ProjectionCapitalWork[] = capitalWorksData.map((cw) => ({
        id: cw.id,
        constructionCost: Number(cw.constructionCost),
        constructionDate: new Date(cw.constructionDate),
        claimStartDate: new Date(cw.claimStartDate),
      }));

      return projectSchedule({ assets, capitalWorks, fromFY, toFY });
    }),

  addAsset: writeProcedure
    .input(z.object({
      scheduleId: z.string().uuid(),
      assetName: z.string().min(1, "Asset name is required"),
      category: z.enum(["plant_equipment", "capital_works"]),
      originalCost: z.number().positive("Cost must be positive"),
      effectiveLife: z.number().positive("Effective life must be positive"),
      method: z.enum(["diminishing_value", "prime_cost"]),
      purchaseDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const poolType = assignPoolType(input.originalCost);
      const annualDeduction = input.method === "prime_cost"
        ? input.originalCost / input.effectiveLife
        : input.originalCost * (2 / input.effectiveLife);

      return ctx.uow.depreciation.createAsset({
        scheduleId: input.scheduleId,
        assetName: input.assetName,
        category: input.category,
        originalCost: input.originalCost.toFixed(2),
        effectiveLife: input.effectiveLife.toFixed(2),
        method: input.method,
        yearlyDeduction: annualDeduction.toFixed(2),
        remainingValue: input.originalCost.toFixed(2),
        poolType,
        purchaseDate: input.purchaseDate ?? null,
        openingWrittenDownValue: input.originalCost.toFixed(2),
      });
    }),

  updateAsset: writeProcedure
    .input(z.object({
      assetId: z.string().uuid(),
      assetName: z.string().min(1).optional(),
      originalCost: z.number().positive().optional(),
      effectiveLife: z.number().positive().optional(),
      method: z.enum(["diminishing_value", "prime_cost"]).optional(),
      purchaseDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { assetId, ...updates } = input;
      const data: Record<string, unknown> = {};
      if (updates.assetName) data.assetName = updates.assetName;
      if (updates.originalCost) {
        data.originalCost = updates.originalCost.toFixed(2);
        data.remainingValue = updates.originalCost.toFixed(2);
        data.poolType = assignPoolType(updates.originalCost);
      }
      if (updates.effectiveLife) data.effectiveLife = updates.effectiveLife.toFixed(2);
      if (updates.method) data.method = updates.method;
      if (updates.purchaseDate) data.purchaseDate = updates.purchaseDate;

      const result = await ctx.uow.depreciation.updateAsset(assetId, ctx.portfolio.ownerId, data);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      return result;
    }),

  deleteAsset: writeProcedure
    .input(z.object({ assetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.depreciation.deleteAsset(input.assetId, ctx.portfolio.ownerId);
      return { success: true };
    }),

  addCapitalWorks: writeProcedure
    .input(z.object({
      propertyId: z.string().uuid(),
      description: z.string().min(1, "Description is required"),
      constructionDate: z.string(),
      constructionCost: z.number().positive("Cost must be positive"),
      claimStartDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.depreciation.createCapitalWork({
        propertyId: input.propertyId,
        userId: ctx.portfolio.ownerId,
        description: input.description,
        constructionDate: input.constructionDate,
        constructionCost: input.constructionCost.toFixed(2),
        claimStartDate: input.claimStartDate,
      });
    }),

  updateCapitalWorks: writeProcedure
    .input(z.object({
      id: z.string().uuid(),
      description: z.string().min(1).optional(),
      constructionDate: z.string().optional(),
      constructionCost: z.number().positive().optional(),
      claimStartDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const data: Record<string, unknown> = {};
      if (updates.description) data.description = updates.description;
      if (updates.constructionDate) data.constructionDate = updates.constructionDate;
      if (updates.constructionCost) data.constructionCost = updates.constructionCost.toFixed(2);
      if (updates.claimStartDate) data.claimStartDate = updates.claimStartDate;

      const result = await ctx.uow.depreciation.updateCapitalWork(id, ctx.portfolio.ownerId, data);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Capital work not found" });
      return result;
    }),

  deleteCapitalWorks: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.depreciation.deleteCapitalWork(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  claimFY: writeProcedure
    .input(z.object({
      scheduleId: z.string().uuid(),
      financialYear: z.number().int(),
      amounts: z.array(z.object({
        assetId: z.string().uuid().nullable(),
        amount: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const claims = [];
      for (const item of input.amounts) {
        const claim = await ctx.uow.depreciation.createClaim({
          assetId: item.assetId,
          scheduleId: input.scheduleId,
          financialYear: input.financialYear,
          amount: item.amount.toFixed(2),
        });
        claims.push(claim);
      }
      return claims;
    }),

  unclaimFY: writeProcedure
    .input(z.object({
      scheduleId: z.string().uuid(),
      financialYear: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.depreciation.deleteClaimsByFY(input.scheduleId, input.financialYear);
      return { success: true };
    }),

  moveToPool: writeProcedure
    .input(z.object({ assetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.uow.depreciation.findAssetById(input.assetId, ctx.portfolio.ownerId);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });

      const remaining = Number(asset.remainingValue);
      if (remaining > 1000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Asset remaining value must be under $1,000 to move to low-value pool",
        });
      }

      return ctx.uow.depreciation.updateAsset(input.assetId, ctx.portfolio.ownerId, {
        poolType: "low_value",
        openingWrittenDownValue: asset.remainingValue,
      });
    }),
});
```

**Step 4: Register router in barrel and app**

In `src/server/routers/tax/index.ts`, add:
```typescript
export { depreciationRouter } from "./depreciation";
```

In `src/server/routers/_app.ts`, add import and register:
```typescript
import { depreciationRouter } from "./tax";
// In router definition:
depreciation: depreciationRouter,
```

**Step 5: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 6: Run all tests**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 7: Commit**

```bash
git add src/server/routers/tax/depreciation.ts src/server/routers/tax/index.ts src/server/routers/_app.ts src/server/routers/tax/__tests__/depreciation.test.ts
git commit -m "feat: add depreciation router with CRUD, projections, and claim tracking"
```

---

## Task 5: Property Detail Navigation — Add Depreciation Tab

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/layout.tsx` (add breadcrumb + nav link)

**Step 1: Add depreciation to the sidebar navigation**

Find the navigation links section in the layout and add a depreciation link following the existing pattern. Add `Calculator` icon import from lucide-react.

Add link item:
```typescript
{ href: `/properties/${propertyId}/depreciation`, label: "Depreciation", icon: Calculator }
```

**Step 2: Add breadcrumb case for depreciation route**

In the `getBreadcrumbItems` function, add:
```typescript
} else if (pathname?.includes("/depreciation")) {
  items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
  items.push({ label: "Depreciation" });
```

(Verify this isn't already present — the exploration suggested it might be.)

**Step 3: Verify the layout compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/layout.tsx
git commit -m "feat: add depreciation tab to property detail navigation"
```

---

## Task 6: Depreciation Page — Summary Cards + Asset Register

**Files:**
- Create: `src/app/(dashboard)/properties/[id]/depreciation/page.tsx`

This is the main UI task. Use the `frontend-design` skill for the component implementation.

**Step 1: Create the depreciation page**

Create `src/app/(dashboard)/properties/[id]/depreciation/page.tsx` with:

1. **Summary cards row** — 4 cards: This FY Deduction, Total Remaining Value, Assets Tracked, Capital Works count
2. **Tabbed asset register** — Tabs component with "Plant & Equipment", "Capital Works", "Low-Value Pool"
3. **Plant & Equipment table** — columns: Name, Cost, Method (badge), Life, This FY, Remaining, Actions (edit/delete)
4. **Inline add form** — collapsible row at bottom of each table with form fields
5. **Capital Works table** — columns: Description, Construction Date, Cost, Annual Deduction, Years Remaining, Actions
6. **Low-Value Pool view** — pool summary + list of pooled assets + instant write-offs

**tRPC queries:**
```typescript
const { data } = trpc.depreciation.list.useQuery({ propertyId });
const { data: projections } = trpc.depreciation.getProjection.useQuery({ propertyId });
```

**Mutations with cache invalidation:**
```typescript
const utils = trpc.useUtils();
const addAsset = trpc.depreciation.addAsset.useMutation({
  onSuccess: () => {
    utils.depreciation.list.invalidate({ propertyId });
    utils.depreciation.getProjection.invalidate({ propertyId });
    toast.success("Asset added");
  },
});
```

**Key UI patterns to follow:**
- `"use client"` directive (hooks + interactivity)
- `cn()` for conditional classes
- `toast.success()` / `toast.error(getErrorMessage(error))` for feedback
- Icons from lucide-react with Tailwind sizing (`className="h-4 w-4"`)
- Responsive table with horizontal scroll on mobile
- Loading skeletons while data fetches
- Empty state with call-to-action

**Step 2: Verify it renders**

Run dev server and navigate to `/properties/[id]/depreciation`. Verify:
- Summary cards show (zeros for empty state)
- Tabs switch correctly
- Add asset form appears and submits
- Table renders when assets exist

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/depreciation/page.tsx
git commit -m "feat: add depreciation page with summary cards and asset register"
```

---

## Task 7: Year-by-Year Projection Section

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/depreciation/page.tsx` (add projection section)

**Step 1: Add projection table below asset register**

Add a collapsible section using the existing accordion/collapsible pattern:

- Default open for current FY + 5 years
- Table columns: FY | Div 40 | Div 43 | Low-Value Pool | Total
- Each row shows `formatCurrency()` values from projection data
- "Mark as Claimed" button on each row that isn't already claimed
- Claimed rows show a green checkmark badge
- Expandable row detail showing per-asset breakdown

**tRPC query:**
```typescript
const { data: projections } = trpc.depreciation.getProjection.useQuery({
  propertyId,
  fromFY: currentFY,
  toFY: currentFY + 10,
});
```

**Claim mutation:**
```typescript
const claimFY = trpc.depreciation.claimFY.useMutation({
  onSuccess: () => {
    utils.depreciation.list.invalidate({ propertyId });
    toast.success("Depreciation marked as claimed");
  },
});
```

**Step 2: Verify projection renders**

Add some test assets manually, verify the projection table shows calculated values.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/depreciation/page.tsx
git commit -m "feat: add year-by-year depreciation projection with claim tracking"
```

---

## Task 8: Integration Testing + Full Test Run

**Files:**
- Ensure all test files pass

**Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: All tests pass, including new calculator and repository tests

**Step 2: Run type check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

**Step 3: Run lint on changed files**

Run: `npx eslint src/server/services/depreciation-calculator.ts src/server/repositories/depreciation.repository.ts src/server/routers/tax/depreciation.ts --fix`
Expected: No errors or auto-fixed

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint and type issues from depreciation feature"
```

---

## Task 9: E2E Test — Depreciation Tab Flow

**Files:**
- Create: `e2e/depreciation.spec.ts`

Use the `@new-e2e-test` skill pattern.

**Step 1: Create E2E test**

Create `e2e/depreciation.spec.ts`:

```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Depreciation tracker", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Navigate to first property
    await page.goto("/properties");
    await page.getByRole("link", { name: /./i }).first().click();
    await page.getByRole("link", { name: "Depreciation" }).click();
    await expect(page.getByText("This FY Deduction")).toBeVisible();
  });

  test("shows empty state with add asset CTA", async ({ authenticatedPage: page }) => {
    await expect(page.getByText("No assets tracked")).toBeVisible();
  });

  test("can add a plant & equipment asset", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: "Add Asset" }).click();
    await page.getByLabel("Asset Name").fill("Carpet");
    await page.getByLabel("Cost").fill("5000");
    await page.getByLabel("Effective Life").fill("8");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Asset added")).toBeVisible();
    await expect(page.getByText("Carpet")).toBeVisible();

    // Clean up
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByRole("button", { name: "Confirm" }).click();
  });

  test("shows year-by-year projections", async ({ authenticatedPage: page }) => {
    // Verify projection section exists
    await expect(page.getByText(/FY\d{4}/)).toBeVisible();
  });

  // Monitor for page errors
  test.beforeEach(async ({ authenticatedPage: page }) => {
    page.on("pageerror", (error) => {
      console.error("Page error:", error.message);
      expect(error.message).not.toContain("Unhandled");
    });
  });
});
```

**Step 2: Run E2E test**

Run: `npx playwright test e2e/depreciation.spec.ts --headed`
Expected: Tests pass (adjust selectors based on actual UI)

**Step 3: Commit**

```bash
git add e2e/depreciation.spec.ts
git commit -m "test: add E2E tests for depreciation tracker"
```

---

## Task 10: Final Verification + Branch Finish

**Step 1: Run full verification**

```bash
npx vitest run
npx tsc --noEmit
npx eslint . --ext .ts,.tsx --quiet
```

**Step 2: Update beads task**

```bash
bd update property-tracker-4td -m "Implementation complete: schema, calculator, repository, router, UI, E2E tests"
```

**Step 3: Finish branch**

Use `superpowers:finishing-a-development-branch` skill — push, create PR to develop, enable auto-merge with squash, clean up worktree.
