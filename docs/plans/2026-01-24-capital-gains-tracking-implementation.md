# Capital Gains Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track property cost base while owning, calculate CGT with 50% discount when selling, archive sold properties.

**Architecture:** New `property_sales` table stores sale events with calculated CGT. Cost base derived from purchase price + capital transactions. Properties get `status` and `soldAt` fields for active/sold state.

**Tech Stack:** Drizzle ORM, tRPC, React, Vitest, existing UI patterns from reports feature.

---

### Task 1: Add property status to schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add property status enum and fields**

Add after line 86 (after `rateTypeEnum`):

```typescript
export const propertyStatusEnum = pgEnum("property_status", ["active", "sold"]);
```

Add to properties table (after `entityName` field, around line 109):

```typescript
  status: propertyStatusEnum("status").default("active").notNull(),
  soldAt: date("sold_at"),
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(schema): add property status enum and fields for CGT tracking"
```

---

### Task 2: Add property_sales table to schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add property_sales table**

Add after the loans table (around line 193):

```typescript
export const propertySales = pgTable("property_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  // Sale details
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
  settlementDate: date("settlement_date").notNull(),
  contractDate: date("contract_date"),

  // Selling costs
  agentCommission: decimal("agent_commission", { precision: 12, scale: 2 }).default("0").notNull(),
  legalFees: decimal("legal_fees", { precision: 12, scale: 2 }).default("0").notNull(),
  marketingCosts: decimal("marketing_costs", { precision: 12, scale: 2 }).default("0").notNull(),
  otherSellingCosts: decimal("other_selling_costs", { precision: 12, scale: 2 }).default("0").notNull(),

  // Calculated CGT fields (stored for historical accuracy)
  costBase: decimal("cost_base", { precision: 12, scale: 2 }).notNull(),
  capitalGain: decimal("capital_gain", { precision: 12, scale: 2 }).notNull(),
  discountedGain: decimal("discounted_gain", { precision: 12, scale: 2 }),
  heldOverTwelveMonths: boolean("held_over_twelve_months").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2: Add relations for property_sales**

Add after `loansRelations` (around line 252):

```typescript
export const propertySalesRelations = relations(propertySales, ({ one }) => ({
  property: one(properties, {
    fields: [propertySales.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [propertySales.userId],
    references: [users.id],
  }),
}));
```

Update `propertiesRelations` to include sales:

```typescript
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  bankAccounts: many(bankAccounts),
  loans: many(loans),
  sales: many(propertySales),
}));
```

**Step 3: Add type exports**

Add after existing type exports (around line 264):

```typescript
export type PropertySale = typeof propertySales.$inferSelect;
export type NewPropertySale = typeof propertySales.$inferInsert;
```

**Step 4: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(schema): add property_sales table for CGT tracking"
```

---

### Task 3: Generate and run database migration

**Files:**
- Create: `drizzle/XXXX_add_cgt_tables.sql` (auto-generated)

**Step 1: Generate migration**

Run: `npx drizzle-kit generate`
Expected: Migration file created in drizzle folder

**Step 2: Review migration file**

Read the generated migration file and verify it includes:
- `property_status` enum creation
- `status` and `sold_at` columns on properties
- `property_sales` table creation

**Step 3: Apply migration (development)**

Run: `npx drizzle-kit push`
Expected: Schema changes applied to database

**Step 4: Commit**

```bash
git add drizzle/
git commit -m "chore(db): add migration for CGT tables"
```

---

### Task 4: Create CGT service with cost base calculation

**Files:**
- Create: `src/server/services/cgt.ts`
- Create: `src/server/services/__tests__/cgt.test.ts`

**Step 1: Write the failing test for calculateCostBase**

Create `src/server/services/__tests__/cgt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateCostBase, calculateCapitalGain, monthsBetween } from "../cgt";

describe("cgt service", () => {
  describe("calculateCostBase", () => {
    it("returns purchase price when no capital transactions", () => {
      const result = calculateCostBase("850000", []);
      expect(result).toBe(850000);
    });

    it("adds capital transaction amounts to purchase price", () => {
      const transactions = [
        { category: "stamp_duty", amount: "-35200" },
        { category: "conveyancing", amount: "-1800" },
        { category: "buyers_agent_fees", amount: "-8500" },
      ];
      const result = calculateCostBase("850000", transactions);
      expect(result).toBe(850000 + 35200 + 1800 + 8500);
    });

    it("ignores non-capital transaction categories", () => {
      const transactions = [
        { category: "stamp_duty", amount: "-35200" },
        { category: "rental_income", amount: "2400" },
        { category: "insurance", amount: "-500" },
      ];
      const result = calculateCostBase("850000", transactions);
      expect(result).toBe(850000 + 35200);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/cgt.test.ts`
Expected: FAIL with "Cannot find module '../cgt'"

**Step 3: Write minimal implementation**

Create `src/server/services/cgt.ts`:

```typescript
const CAPITAL_CATEGORIES = [
  "stamp_duty",
  "conveyancing",
  "buyers_agent_fees",
  "initial_repairs",
];

export interface CapitalTransaction {
  category: string;
  amount: string;
}

/**
 * Calculate cost base from purchase price and capital transactions
 * Cost base = Purchase Price + Acquisition Costs
 */
export function calculateCostBase(
  purchasePrice: string,
  capitalTransactions: CapitalTransaction[]
): number {
  const baseCost = Number(purchasePrice);

  const acquisitionCosts = capitalTransactions
    .filter((t) => CAPITAL_CATEGORIES.includes(t.category))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return baseCost + acquisitionCosts;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/cgt.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/server/services/cgt.ts src/server/services/__tests__/cgt.test.ts
git commit -m "feat(cgt): add calculateCostBase function with tests"
```

---

### Task 5: Add months between calculation

**Files:**
- Modify: `src/server/services/cgt.ts`
- Modify: `src/server/services/__tests__/cgt.test.ts`

**Step 1: Write the failing test for monthsBetween**

Add to `src/server/services/__tests__/cgt.test.ts`:

```typescript
  describe("monthsBetween", () => {
    it("calculates months between two dates", () => {
      expect(monthsBetween("2024-01-15", "2025-01-15")).toBe(12);
    });

    it("handles partial months", () => {
      expect(monthsBetween("2024-01-15", "2024-07-14")).toBe(5);
    });

    it("returns 0 for same date", () => {
      expect(monthsBetween("2024-01-15", "2024-01-15")).toBe(0);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/cgt.test.ts`
Expected: FAIL with "monthsBetween is not a function" or undefined

**Step 3: Add monthsBetween implementation**

Add to `src/server/services/cgt.ts`:

```typescript
/**
 * Calculate months between two dates
 */
export function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();

  return years * 12 + months;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/cgt.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/server/services/cgt.ts src/server/services/__tests__/cgt.test.ts
git commit -m "feat(cgt): add monthsBetween helper function"
```

---

### Task 6: Add capital gain calculation

**Files:**
- Modify: `src/server/services/cgt.ts`
- Modify: `src/server/services/__tests__/cgt.test.ts`

**Step 1: Write the failing tests for calculateCapitalGain**

Add to `src/server/services/__tests__/cgt.test.ts`:

```typescript
  describe("calculateCapitalGain", () => {
    it("calculates gain with 50% discount when held over 12 months", () => {
      const result = calculateCapitalGain({
        costBase: 900000,
        salePrice: 1100000,
        sellingCosts: {
          agentCommission: 22000,
          legalFees: 1500,
          marketingCosts: 3000,
          otherSellingCosts: 0,
        },
        purchaseDate: "2022-01-15",
        settlementDate: "2025-06-15",
      });

      expect(result.heldOverTwelveMonths).toBe(true);
      // Net proceeds: 1100000 - 26500 = 1073500
      // Capital gain: 1073500 - 900000 = 173500
      expect(result.capitalGain).toBe(173500);
      // Discounted: 173500 * 0.5 = 86750
      expect(result.discountedGain).toBe(86750);
    });

    it("does not apply discount when held under 12 months", () => {
      const result = calculateCapitalGain({
        costBase: 900000,
        salePrice: 1100000,
        sellingCosts: {
          agentCommission: 22000,
          legalFees: 1500,
          marketingCosts: 3000,
          otherSellingCosts: 0,
        },
        purchaseDate: "2025-01-15",
        settlementDate: "2025-06-15",
      });

      expect(result.heldOverTwelveMonths).toBe(false);
      expect(result.capitalGain).toBe(173500);
      expect(result.discountedGain).toBe(173500); // No discount
    });

    it("does not apply discount on capital loss", () => {
      const result = calculateCapitalGain({
        costBase: 900000,
        salePrice: 800000,
        sellingCosts: {
          agentCommission: 16000,
          legalFees: 1500,
          marketingCosts: 0,
          otherSellingCosts: 0,
        },
        purchaseDate: "2022-01-15",
        settlementDate: "2025-06-15",
      });

      expect(result.heldOverTwelveMonths).toBe(true);
      // Net proceeds: 800000 - 17500 = 782500
      // Capital loss: 782500 - 900000 = -117500
      expect(result.capitalGain).toBe(-117500);
      // No discount on loss
      expect(result.discountedGain).toBe(-117500);
    });

    it("handles exactly 12 months as eligible for discount", () => {
      const result = calculateCapitalGain({
        costBase: 500000,
        salePrice: 600000,
        sellingCosts: {
          agentCommission: 12000,
          legalFees: 1000,
          marketingCosts: 0,
          otherSellingCosts: 0,
        },
        purchaseDate: "2024-01-15",
        settlementDate: "2025-01-15",
      });

      expect(result.heldOverTwelveMonths).toBe(true);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/cgt.test.ts`
Expected: FAIL with "calculateCapitalGain is not defined"

**Step 3: Add calculateCapitalGain implementation**

Add to `src/server/services/cgt.ts`:

```typescript
export interface SellingCosts {
  agentCommission: number;
  legalFees: number;
  marketingCosts: number;
  otherSellingCosts: number;
}

export interface CapitalGainInput {
  costBase: number;
  salePrice: number;
  sellingCosts: SellingCosts;
  purchaseDate: string;
  settlementDate: string;
}

export interface CapitalGainResult {
  costBase: number;
  salePrice: number;
  totalSellingCosts: number;
  netProceeds: number;
  capitalGain: number;
  discountedGain: number;
  heldOverTwelveMonths: boolean;
}

/**
 * Calculate capital gain/loss from property sale
 * - 50% CGT discount applies if held >= 12 months AND gain is positive
 * - Capital losses are NOT discounted
 */
export function calculateCapitalGain(input: CapitalGainInput): CapitalGainResult {
  const { costBase, salePrice, sellingCosts, purchaseDate, settlementDate } = input;

  const totalSellingCosts =
    sellingCosts.agentCommission +
    sellingCosts.legalFees +
    sellingCosts.marketingCosts +
    sellingCosts.otherSellingCosts;

  const netProceeds = salePrice - totalSellingCosts;
  const capitalGain = netProceeds - costBase;

  const heldMonths = monthsBetween(purchaseDate, settlementDate);
  const heldOverTwelveMonths = heldMonths >= 12;

  // 50% discount only if held >= 12 months AND gain is positive
  const discountedGain =
    heldOverTwelveMonths && capitalGain > 0
      ? capitalGain * 0.5
      : capitalGain;

  return {
    costBase,
    salePrice,
    totalSellingCosts,
    netProceeds,
    capitalGain,
    discountedGain,
    heldOverTwelveMonths,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/cgt.test.ts`
Expected: PASS (10 tests)

**Step 5: Commit**

```bash
git add src/server/services/cgt.ts src/server/services/__tests__/cgt.test.ts
git commit -m "feat(cgt): add calculateCapitalGain function with 50% discount logic"
```

---

### Task 7: Add database query functions to CGT service

**Files:**
- Modify: `src/server/services/cgt.ts`

**Step 1: Add getPropertyCostBase function**

Add to `src/server/services/cgt.ts`:

```typescript
import { db } from "@/server/db";
import { properties, transactions, propertySales } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Get property with its capital transactions for cost base calculation
 */
export async function getPropertyWithCapitalTransactions(
  propertyId: string,
  userId: string
) {
  const property = await db.query.properties.findFirst({
    where: and(
      eq(properties.id, propertyId),
      eq(properties.userId, userId)
    ),
  });

  if (!property) {
    return null;
  }

  const capitalTxns = await db.query.transactions.findMany({
    where: and(
      eq(transactions.propertyId, propertyId),
      eq(transactions.userId, userId)
    ),
  });

  const capitalOnly = capitalTxns.filter((t) =>
    CAPITAL_CATEGORIES.includes(t.category)
  );

  return {
    property,
    capitalTransactions: capitalOnly,
  };
}

/**
 * Get sale record for a property
 */
export async function getPropertySale(propertyId: string, userId: string) {
  return db.query.propertySales.findFirst({
    where: and(
      eq(propertySales.propertyId, propertyId),
      eq(propertySales.userId, userId)
    ),
    with: {
      property: true,
    },
  });
}
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/cgt.ts
git commit -m "feat(cgt): add database query functions for property and sales"
```

---

### Task 8: Create CGT tRPC router - getCostBase

**Files:**
- Create: `src/server/routers/cgt.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create CGT router with getCostBase endpoint**

Create `src/server/routers/cgt.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { properties, transactions, propertySales } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateCostBase,
  calculateCapitalGain,
  CAPITAL_CATEGORIES,
} from "../services/cgt";

export const cgtRouter = router({
  /**
   * Get cost base breakdown for a property
   */
  getCostBase: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { propertyId } = input;

      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Get capital transactions
      const allTxns = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, propertyId),
          eq(transactions.userId, ctx.user.id)
        ),
      });

      const capitalTxns = allTxns.filter((t) =>
        CAPITAL_CATEGORIES.includes(t.category)
      );

      // Calculate cost base
      const totalCostBase = calculateCostBase(property.purchasePrice, capitalTxns);

      // Build breakdown
      const breakdown = capitalTxns.map((t) => ({
        category: t.category,
        description: t.description,
        amount: Math.abs(Number(t.amount)),
        date: t.date,
      }));

      return {
        propertyId,
        purchasePrice: Number(property.purchasePrice),
        purchaseDate: property.purchaseDate,
        acquisitionCosts: breakdown,
        totalAcquisitionCosts: breakdown.reduce((sum, b) => sum + b.amount, 0),
        totalCostBase,
      };
    }),
});
```

**Step 2: Export CAPITAL_CATEGORIES from cgt service**

Modify `src/server/services/cgt.ts` to export the constant:

Change `const CAPITAL_CATEGORIES` to `export const CAPITAL_CATEGORIES`

**Step 3: Add cgtRouter to _app.ts**

Modify `src/server/routers/_app.ts`:

```typescript
import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";
import { statsRouter } from "./stats";
import { loanRouter } from "./loan";
import { reportsRouter } from "./reports";
import { cgtRouter } from "./cgt";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
  loan: loanRouter,
  reports: reportsRouter,
  cgt: cgtRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 4: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/routers/cgt.ts src/server/routers/_app.ts src/server/services/cgt.ts
git commit -m "feat(cgt): add cgtRouter with getCostBase endpoint"
```

---

### Task 9: Add getSummary endpoint to CGT router

**Files:**
- Modify: `src/server/routers/cgt.ts`

**Step 1: Add getSummary endpoint**

Add to `src/server/routers/cgt.ts` inside the router:

```typescript
  /**
   * Get CGT summary for all user properties
   */
  getSummary: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "sold", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status } = input;

      // Get all properties
      let userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.user.id),
        with: {
          sales: true,
        },
      });

      // Filter by status if needed
      if (status === "active") {
        userProperties = userProperties.filter((p) => p.status === "active");
      } else if (status === "sold") {
        userProperties = userProperties.filter((p) => p.status === "sold");
      }

      // Get all capital transactions for the user
      const allTxns = await ctx.db.query.transactions.findMany({
        where: eq(transactions.userId, ctx.user.id),
      });

      // Build summary for each property
      const propertySummaries = userProperties.map((property) => {
        const propertyCapitalTxns = allTxns.filter(
          (t) =>
            t.propertyId === property.id &&
            CAPITAL_CATEGORIES.includes(t.category)
        );

        const costBase = calculateCostBase(
          property.purchasePrice,
          propertyCapitalTxns
        );

        const sale = property.sales?.[0];

        return {
          id: property.id,
          address: property.address,
          suburb: property.suburb,
          state: property.state,
          status: property.status,
          purchasePrice: Number(property.purchasePrice),
          purchaseDate: property.purchaseDate,
          costBase,
          sale: sale
            ? {
                salePrice: Number(sale.salePrice),
                settlementDate: sale.settlementDate,
                capitalGain: Number(sale.capitalGain),
                discountedGain: sale.discountedGain
                  ? Number(sale.discountedGain)
                  : null,
                heldOverTwelveMonths: sale.heldOverTwelveMonths,
              }
            : null,
        };
      });

      return {
        properties: propertySummaries,
        totals: {
          activeCount: propertySummaries.filter((p) => p.status === "active").length,
          soldCount: propertySummaries.filter((p) => p.status === "sold").length,
          totalCostBase: propertySummaries
            .filter((p) => p.status === "active")
            .reduce((sum, p) => sum + p.costBase, 0),
        },
      };
    }),
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/routers/cgt.ts
git commit -m "feat(cgt): add getSummary endpoint for all properties"
```

---

### Task 10: Add recordSale endpoint to CGT router

**Files:**
- Modify: `src/server/routers/cgt.ts`

**Step 1: Add recordSale mutation**

Add to `src/server/routers/cgt.ts` inside the router:

```typescript
  /**
   * Record a property sale and archive the property
   */
  recordSale: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        salePrice: z.string().regex(/^\d+\.?\d*$/, "Invalid sale price"),
        settlementDate: z.string(),
        contractDate: z.string().optional(),
        agentCommission: z.string().regex(/^\d+\.?\d*$/).default("0"),
        legalFees: z.string().regex(/^\d+\.?\d*$/).default("0"),
        marketingCosts: z.string().regex(/^\d+\.?\d*$/).default("0"),
        otherSellingCosts: z.string().regex(/^\d+\.?\d*$/).default("0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, salePrice, settlementDate, contractDate, ...costs } = input;

      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Check property is not already sold
      if (property.status === "sold") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Property is already sold",
        });
      }

      // Validate settlement date is after purchase date
      if (new Date(settlementDate) <= new Date(property.purchaseDate)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Settlement date must be after purchase date",
        });
      }

      // Get capital transactions for cost base
      const allTxns = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, propertyId),
          eq(transactions.userId, ctx.user.id)
        ),
      });

      const capitalTxns = allTxns.filter((t) =>
        CAPITAL_CATEGORIES.includes(t.category)
      );

      // Calculate cost base
      const costBase = calculateCostBase(property.purchasePrice, capitalTxns);

      // Calculate capital gain
      const cgtResult = calculateCapitalGain({
        costBase,
        salePrice: Number(salePrice),
        sellingCosts: {
          agentCommission: Number(costs.agentCommission),
          legalFees: Number(costs.legalFees),
          marketingCosts: Number(costs.marketingCosts),
          otherSellingCosts: Number(costs.otherSellingCosts),
        },
        purchaseDate: property.purchaseDate,
        settlementDate,
      });

      // Create sale record and update property status in transaction
      const [sale] = await ctx.db
        .insert(propertySales)
        .values({
          propertyId,
          userId: ctx.user.id,
          salePrice,
          settlementDate,
          contractDate,
          agentCommission: costs.agentCommission,
          legalFees: costs.legalFees,
          marketingCosts: costs.marketingCosts,
          otherSellingCosts: costs.otherSellingCosts,
          costBase: String(costBase),
          capitalGain: String(cgtResult.capitalGain),
          discountedGain: String(cgtResult.discountedGain),
          heldOverTwelveMonths: cgtResult.heldOverTwelveMonths,
        })
        .returning();

      // Archive the property
      await ctx.db
        .update(properties)
        .set({
          status: "sold",
          soldAt: settlementDate,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, propertyId));

      return {
        sale,
        cgtResult,
      };
    }),
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/routers/cgt.ts
git commit -m "feat(cgt): add recordSale mutation with CGT calculation"
```

---

### Task 11: Add getSaleDetails and getSellingCosts endpoints

**Files:**
- Modify: `src/server/routers/cgt.ts`

**Step 1: Add getSaleDetails endpoint**

Add to `src/server/routers/cgt.ts` inside the router:

```typescript
  /**
   * Get sale details for a sold property
   */
  getSaleDetails: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sale = await ctx.db.query.propertySales.findFirst({
        where: and(
          eq(propertySales.propertyId, input.propertyId),
          eq(propertySales.userId, ctx.user.id)
        ),
        with: {
          property: true,
        },
      });

      if (!sale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sale record not found",
        });
      }

      return {
        property: {
          id: sale.property.id,
          address: sale.property.address,
          suburb: sale.property.suburb,
          state: sale.property.state,
          purchasePrice: Number(sale.property.purchasePrice),
          purchaseDate: sale.property.purchaseDate,
        },
        sale: {
          salePrice: Number(sale.salePrice),
          settlementDate: sale.settlementDate,
          contractDate: sale.contractDate,
          agentCommission: Number(sale.agentCommission),
          legalFees: Number(sale.legalFees),
          marketingCosts: Number(sale.marketingCosts),
          otherSellingCosts: Number(sale.otherSellingCosts),
          costBase: Number(sale.costBase),
          capitalGain: Number(sale.capitalGain),
          discountedGain: sale.discountedGain ? Number(sale.discountedGain) : null,
          heldOverTwelveMonths: sale.heldOverTwelveMonths,
        },
      };
    }),

  /**
   * Get potential selling costs from transactions (for auto-fill)
   */
  getSellingCosts: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Validate property ownership
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Look for transactions that might be selling costs
      // (property_agent_fees, legal_expenses near recent dates)
      const potentialCosts = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, input.propertyId),
          eq(transactions.userId, ctx.user.id)
        ),
        orderBy: (t, { desc }) => [desc(t.date)],
      });

      // Filter to likely selling cost categories
      const sellingCostCategories = ["property_agent_fees", "legal_expenses"];
      const sellingCosts = potentialCosts.filter((t) =>
        sellingCostCategories.includes(t.category)
      );

      return {
        transactions: sellingCosts.map((t) => ({
          id: t.id,
          category: t.category,
          description: t.description,
          amount: Math.abs(Number(t.amount)),
          date: t.date,
        })),
      };
    }),
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/routers/cgt.ts
git commit -m "feat(cgt): add getSaleDetails and getSellingCosts endpoints"
```

---

### Task 12: Add unit tests for CGT router

**Files:**
- Create: `src/server/routers/__tests__/cgt.test.ts`

**Step 1: Create test file with getCostBase tests**

Create `src/server/routers/__tests__/cgt.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("cgt router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperty = {
    id: "prop-1",
    userId: "user-1",
    address: "123 Main St",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
    purchasePrice: "850000",
    purchaseDate: "2022-06-15",
    entityName: "Personal",
    status: "active",
    soldAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCostBase", () => {
    it("returns cost base with capital transactions", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const mockTransactions = [
        { id: "tx-1", propertyId: "prop-1", category: "stamp_duty", amount: "-35200", description: "Stamp duty" },
        { id: "tx-2", propertyId: "prop-1", category: "conveyancing", amount: "-1800", description: "Conveyancing" },
        { id: "tx-3", propertyId: "prop-1", category: "rental_income", amount: "2400", description: "Rent" },
      ];

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.cgt.getCostBase({ propertyId: "prop-1" });

      expect(result.purchasePrice).toBe(850000);
      expect(result.totalAcquisitionCosts).toBe(37000);
      expect(result.totalCostBase).toBe(887000);
      expect(result.acquisitionCosts).toHaveLength(2);
    });

    it("throws NOT_FOUND for non-existent property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.cgt.getCostBase({ propertyId: "550e8400-e29b-41d4-a716-446655440000" })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("recordSale", () => {
    it("creates sale record and archives property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const mockTransactions = [
        { id: "tx-1", propertyId: "prop-1", category: "stamp_duty", amount: "-35200" },
      ];

      const mockSale = {
        id: "sale-1",
        propertyId: "prop-1",
        salePrice: "1100000",
        costBase: "885200",
        capitalGain: "200000",
        discountedGain: "100000",
        heldOverTwelveMonths: true,
      };

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSale]),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
        insert: insertMock,
        update: updateMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.cgt.recordSale({
        propertyId: "prop-1",
        salePrice: "1100000",
        settlementDate: "2025-06-15",
        agentCommission: "22000",
        legalFees: "1500",
      });

      expect(result.sale).toBeDefined();
      expect(insertMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalled();
    });

    it("rejects sale for already sold property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const soldProperty = { ...mockProperty, status: "sold" };

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(soldProperty) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.cgt.recordSale({
          propertyId: "prop-1",
          salePrice: "1100000",
          settlementDate: "2025-06-15",
        })
      ).rejects.toThrow("Property is already sold");
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/server/routers/__tests__/cgt.test.ts`
Expected: PASS (4 tests)

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/cgt.test.ts
git commit -m "test(cgt): add unit tests for CGT router"
```

---

### Task 13: Create CostBaseCard component

**Files:**
- Create: `src/components/cgt/CostBaseCard.tsx`

**Step 1: Create the component**

Create `src/components/cgt/CostBaseCard.tsx`:

```typescript
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

interface CostBaseCardProps {
  propertyId: string;
}

export function CostBaseCard({ propertyId }: CostBaseCardProps) {
  const { data, isLoading } = trpc.cgt.getCostBase.useQuery({ propertyId });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Link href={`/reports/cgt?propertyId=${propertyId}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle className="text-base">Cost Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Purchase Price</span>
            <span>{formatCurrency(data.purchasePrice)}</span>
          </div>

          {data.acquisitionCosts.map((cost, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-muted-foreground capitalize">
                {cost.category.replace(/_/g, " ")}
              </span>
              <span>{formatCurrency(cost.amount)}</span>
            </div>
          ))}

          <div className="border-t pt-3 flex justify-between font-medium">
            <span>Total Cost Base</span>
            <span>{formatCurrency(data.totalCostBase)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/cgt/CostBaseCard.tsx
git commit -m "feat(cgt): add CostBaseCard component"
```

---

### Task 14: Create CGT Report page

**Files:**
- Create: `src/app/(dashboard)/reports/cgt/page.tsx`

**Step 1: Create the CGT report page**

Create `src/app/(dashboard)/reports/cgt/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Building2, DollarSign } from "lucide-react";
import { RecordSaleDialog } from "@/components/cgt/RecordSaleDialog";

type StatusFilter = "all" | "active" | "sold";

export default function CGTReportPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.cgt.getSummary.useQuery({
    status: statusFilter,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Capital Gains Tax</h2>
          <p className="text-muted-foreground">Track cost base and CGT liability</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Capital Gains Tax</h2>
          <p className="text-muted-foreground">Track cost base and CGT liability</p>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totals.activeCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold Properties</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totals.soldCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost Base (Active)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.totals.totalCostBase ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property List */}
      <div className="space-y-4">
        {data?.properties.map((property) => (
          <Card key={property.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{property.address}</h3>
                    <Badge variant={property.status === "sold" ? "secondary" : "default"}>
                      {property.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {property.suburb}, {property.state}
                  </p>
                </div>

                {property.status === "active" ? (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedPropertyId(property.id)}
                  >
                    Record Sale
                  </Button>
                ) : (
                  <Link href={`/reports/cgt/${property.id}`}>
                    <Button variant="outline">View Sale Details</Button>
                  </Link>
                )}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Price</p>
                  <p className="font-medium">{formatCurrency(property.purchasePrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Date</p>
                  <p className="font-medium">{property.purchaseDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cost Base</p>
                  <p className="font-medium">{formatCurrency(property.costBase)}</p>
                </div>

                {property.sale && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {property.sale.capitalGain >= 0 ? "Capital Gain" : "Capital Loss"}
                    </p>
                    <p className={`font-medium flex items-center gap-1 ${
                      property.sale.capitalGain >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {property.sale.capitalGain >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {formatCurrency(Math.abs(property.sale.capitalGain))}
                      {property.sale.heldOverTwelveMonths && property.sale.capitalGain > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (50% discount: {formatCurrency(property.sale.discountedGain ?? 0)})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {data?.properties.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No properties found</h3>
              <p className="text-muted-foreground">
                {statusFilter === "all"
                  ? "Add a property to start tracking CGT"
                  : `No ${statusFilter} properties`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedPropertyId && (
        <RecordSaleDialog
          propertyId={selectedPropertyId}
          open={!!selectedPropertyId}
          onOpenChange={(open) => !open && setSelectedPropertyId(null)}
          onSuccess={() => {
            setSelectedPropertyId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: May have error about RecordSaleDialog (will create in next task)

**Step 3: Commit**

```bash
git add src/app/(dashboard)/reports/cgt/page.tsx
git commit -m "feat(cgt): add CGT report page"
```

---

### Task 15: Create RecordSaleDialog component

**Files:**
- Create: `src/components/cgt/RecordSaleDialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/cgt/RecordSaleDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const recordSaleSchema = z.object({
  salePrice: z.string().min(1, "Sale price is required"),
  settlementDate: z.string().min(1, "Settlement date is required"),
  contractDate: z.string().optional(),
  agentCommission: z.string().default("0"),
  legalFees: z.string().default("0"),
  marketingCosts: z.string().default("0"),
  otherSellingCosts: z.string().default("0"),
});

type RecordSaleFormValues = z.infer<typeof recordSaleSchema>;

interface RecordSaleDialogProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecordSaleDialog({
  propertyId,
  open,
  onOpenChange,
  onSuccess,
}: RecordSaleDialogProps) {
  const [preview, setPreview] = useState<{
    costBase: number;
    capitalGain: number;
    discountedGain: number;
    heldOverTwelveMonths: boolean;
  } | null>(null);

  const { data: costBaseData } = trpc.cgt.getCostBase.useQuery({ propertyId });

  const recordSale = trpc.cgt.recordSale.useMutation({
    onSuccess: () => {
      toast.success("Property sale recorded successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record sale");
    },
  });

  const form = useForm<RecordSaleFormValues>({
    resolver: zodResolver(recordSaleSchema),
    defaultValues: {
      salePrice: "",
      settlementDate: "",
      contractDate: "",
      agentCommission: "0",
      legalFees: "0",
      marketingCosts: "0",
      otherSellingCosts: "0",
    },
  });

  const watchedValues = form.watch();

  // Calculate preview when values change
  const calculatePreview = () => {
    if (!costBaseData || !watchedValues.salePrice || !watchedValues.settlementDate) {
      setPreview(null);
      return;
    }

    const salePrice = Number(watchedValues.salePrice) || 0;
    const totalSellingCosts =
      (Number(watchedValues.agentCommission) || 0) +
      (Number(watchedValues.legalFees) || 0) +
      (Number(watchedValues.marketingCosts) || 0) +
      (Number(watchedValues.otherSellingCosts) || 0);

    const netProceeds = salePrice - totalSellingCosts;
    const capitalGain = netProceeds - costBaseData.totalCostBase;

    // Calculate months held
    const purchaseDate = new Date(costBaseData.purchaseDate);
    const settlementDate = new Date(watchedValues.settlementDate);
    const monthsHeld =
      (settlementDate.getFullYear() - purchaseDate.getFullYear()) * 12 +
      (settlementDate.getMonth() - purchaseDate.getMonth());
    const heldOverTwelveMonths = monthsHeld >= 12;

    const discountedGain =
      heldOverTwelveMonths && capitalGain > 0 ? capitalGain * 0.5 : capitalGain;

    setPreview({
      costBase: costBaseData.totalCostBase,
      capitalGain,
      discountedGain,
      heldOverTwelveMonths,
    });
  };

  const onSubmit = (values: RecordSaleFormValues) => {
    recordSale.mutate({
      propertyId,
      ...values,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Property Sale</DialogTitle>
          <DialogDescription>
            Enter the sale details to calculate your capital gain/loss.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          calculatePreview();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="settlementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Settlement Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          calculatePreview();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contractDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Date (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Selling Costs</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agentCommission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Commission</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="legalFees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Fees</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="marketingCosts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marketing Costs</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="otherSellingCosts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Costs</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculatePreview();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {preview && (
              <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                <h4 className="font-medium">CGT Preview</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Cost Base:</span>
                  <span>{formatCurrency(preview.costBase)}</span>
                  <span className="text-muted-foreground">Capital {preview.capitalGain >= 0 ? "Gain" : "Loss"}:</span>
                  <span className={preview.capitalGain >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(Math.abs(preview.capitalGain))}
                  </span>
                  {preview.heldOverTwelveMonths && preview.capitalGain > 0 && (
                    <>
                      <span className="text-muted-foreground">50% Discount Applied:</span>
                      <span className="text-green-600">{formatCurrency(preview.discountedGain)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Held Over 12 Months:</span>
                  <span>{preview.heldOverTwelveMonths ? "Yes" : "No"}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={recordSale.isPending}>
                {recordSale.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Record Sale
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/cgt/RecordSaleDialog.tsx
git commit -m "feat(cgt): add RecordSaleDialog component"
```

---

### Task 16: Add CGT link to sidebar and reports page

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx`

**Step 1: Add CGT card to reports hub**

Read the current reports page and add a CGT report card. Add after the existing report cards:

```typescript
// Add this import at the top
import { TrendingUp } from "lucide-react";

// Add this card to the grid (after existing cards)
<Link href="/reports/cgt">
  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
    <CardHeader>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg">Capital Gains Tax</CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Track cost base, record sales, and calculate CGT with 50% discount.
      </p>
    </CardContent>
  </Card>
</Link>
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/reports/page.tsx
git commit -m "feat(cgt): add CGT report link to reports hub"
```

---

### Task 17: Add CostBaseCard to property detail page

**Files:**
- Modify: `src/app/(dashboard)/properties/[id]/page.tsx` (if exists, or create)

**Step 1: Check if property detail page exists**

If `src/app/(dashboard)/properties/[id]/page.tsx` doesn't exist, create it. If it exists, add the CostBaseCard component.

Add to the property detail page:

```typescript
import { CostBaseCard } from "@/components/cgt/CostBaseCard";

// Add in the page layout where appropriate
{property.status === "active" && (
  <CostBaseCard propertyId={property.id} />
)}
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/[id]/page.tsx
git commit -m "feat(cgt): add CostBaseCard to property detail page"
```

---

### Task 18: Filter archived properties from transaction dropdowns

**Files:**
- Modify: `src/server/routers/property.ts`

**Step 1: Update property list to filter by status**

Modify the `list` procedure in `src/server/routers/property.ts`:

```typescript
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "sold", "all"]).optional().default("active"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "active";

      let conditions = [eq(properties.userId, ctx.user.id)];

      if (status !== "all") {
        conditions.push(eq(properties.status, status));
      }

      return ctx.db.query.properties.findMany({
        where: and(...conditions),
        orderBy: (properties, { desc }) => [desc(properties.createdAt)],
      });
    }),
```

**Step 2: Run TypeScript to verify no errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/routers/property.ts
git commit -m "feat(property): filter list by status, default to active"
```

---

### Task 19: Run all tests and verify

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `npx eslint src --ext .ts,.tsx`
Expected: No errors (or only warnings)

**Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "chore: fix any lint/type issues"
```

---

### Task 20: Final verification and summary

**Files:**
- None (verification only)

**Step 1: Start dev server and test manually**

Run: `npm run dev`

Test:
1. Navigate to /reports/cgt - should see property list
2. Click "Record Sale" on a property - dialog should open
3. Fill in sale details - should see CGT preview
4. Submit - property should move to "sold" status
5. Check property page - CostBaseCard should display for active properties

**Step 2: Verify all features working**

- [ ] getCostBase returns correct breakdown
- [ ] getSummary lists all properties with cost bases
- [ ] recordSale creates sale record and archives property
- [ ] getSaleDetails returns sale info for sold property
- [ ] CostBaseCard displays on property page
- [ ] CGT Report page shows all properties
- [ ] RecordSaleDialog calculates preview correctly
- [ ] Archived properties filtered from dropdowns

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(cgt): complete capital gains tracking implementation"
```
