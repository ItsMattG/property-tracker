# Multi-Property Portfolio View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a portfolio view with three modes (cards, table, aggregate) showing property values, equity, LVR, and cash flow metrics.

**Architecture:** Add `propertyValues` table for value history, create `propertyValue` and `portfolio` routers for data access, build `/portfolio` page with view toggle and Tremor charts.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, Tremor (charts), shadcn/ui, Vitest

---

### Task 1: Add propertyValues Table to Schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add valueSource enum and propertyValues table**

Add after line 111 (after `expectedStatusEnum`):

```typescript
export const valueSourceEnum = pgEnum("value_source", ["manual", "api"]);
```

Add after the `expectedTransactions` table (around line 366):

```typescript
export const propertyValues = pgTable(
  "property_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }).notNull(),
    valueDate: date("value_date").notNull(),
    source: valueSourceEnum("source").default("manual").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_values_property_id_idx").on(table.propertyId),
    index("property_values_user_id_idx").on(table.userId),
    index("property_values_date_idx").on(table.valueDate),
  ]
);
```

**Step 2: Add relations for propertyValues**

Add after `expectedTransactionsRelations`:

```typescript
export const propertyValuesRelations = relations(propertyValues, ({ one }) => ({
  property: one(properties, {
    fields: [propertyValues.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [propertyValues.userId],
    references: [users.id],
  }),
}));
```

Update `propertiesRelations` to include propertyValues:

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
  documents: many(documents),
  propertyValues: many(propertyValues),
}));
```

**Step 3: Add type exports**

Add at the end with other type exports:

```typescript
export type PropertyValue = typeof propertyValues.$inferSelect;
export type NewPropertyValue = typeof propertyValues.$inferInsert;
```

**Step 4: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(schema): add propertyValues table for value history"
```

---

### Task 2: Generate Database Migration

**Files:**
- Create: `drizzle/XXXX_*.sql` (auto-generated)

**Step 1: Generate migration**

Run: `npm run db:generate`

Expected: New migration file created in `drizzle/` folder

**Step 2: Apply migration**

Run: `npm run db:push`

Expected: Schema pushed to database successfully

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "chore(db): add migration for propertyValues table"
```

---

### Task 3: Create Portfolio Calculation Service

**Files:**
- Create: `src/server/services/portfolio.ts`
- Create: `src/server/services/__tests__/portfolio.test.ts`

**Step 1: Write the failing tests**

Create `src/server/services/__tests__/portfolio.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateEquity,
  calculateLVR,
  calculateCashFlow,
  calculateGrossYield,
  calculateNetYield,
  findBestWorst,
} from "../portfolio";

describe("portfolio calculations", () => {
  describe("calculateEquity", () => {
    it("returns value minus total loan balance", () => {
      const result = calculateEquity(500000, 300000);
      expect(result).toBe(200000);
    });

    it("returns full value when no loans", () => {
      const result = calculateEquity(500000, 0);
      expect(result).toBe(500000);
    });

    it("returns negative equity when underwater", () => {
      const result = calculateEquity(400000, 450000);
      expect(result).toBe(-50000);
    });

    it("returns 0 when no value set", () => {
      const result = calculateEquity(0, 300000);
      expect(result).toBe(-300000);
    });
  });

  describe("calculateLVR", () => {
    it("calculates LVR as percentage", () => {
      const result = calculateLVR(300000, 500000);
      expect(result).toBe(60);
    });

    it("returns 0 when no loans", () => {
      const result = calculateLVR(0, 500000);
      expect(result).toBe(0);
    });

    it("returns null when no value set", () => {
      const result = calculateLVR(300000, 0);
      expect(result).toBeNull();
    });

    it("handles over 100% LVR", () => {
      const result = calculateLVR(550000, 500000);
      expect(result).toBe(110);
    });
  });

  describe("calculateCashFlow", () => {
    it("calculates income minus expenses", () => {
      const transactions = [
        { amount: "2400", transactionType: "income" },
        { amount: "-500", transactionType: "expense" },
        { amount: "-300", transactionType: "expense" },
      ];
      const result = calculateCashFlow(transactions as any);
      expect(result).toBe(1600);
    });

    it("returns 0 for empty transactions", () => {
      const result = calculateCashFlow([]);
      expect(result).toBe(0);
    });

    it("ignores transfer and personal transactions", () => {
      const transactions = [
        { amount: "2400", transactionType: "income" },
        { amount: "-1000", transactionType: "transfer" },
        { amount: "-500", transactionType: "personal" },
      ];
      const result = calculateCashFlow(transactions as any);
      expect(result).toBe(2400);
    });
  });

  describe("calculateGrossYield", () => {
    it("calculates annual income / value * 100", () => {
      const result = calculateGrossYield(24000, 500000);
      expect(result).toBe(4.8);
    });

    it("returns null when no value", () => {
      const result = calculateGrossYield(24000, 0);
      expect(result).toBeNull();
    });

    it("returns 0 when no income", () => {
      const result = calculateGrossYield(0, 500000);
      expect(result).toBe(0);
    });
  });

  describe("calculateNetYield", () => {
    it("calculates (income - expenses) / value * 100", () => {
      const result = calculateNetYield(24000, 12000, 500000);
      expect(result).toBe(2.4);
    });

    it("returns null when no value", () => {
      const result = calculateNetYield(24000, 12000, 0);
      expect(result).toBeNull();
    });

    it("handles negative net yield", () => {
      const result = calculateNetYield(12000, 24000, 500000);
      expect(result).toBe(-2.4);
    });
  });

  describe("findBestWorst", () => {
    it("finds best and worst performers", () => {
      const values = [
        { id: "a", value: 100 },
        { id: "b", value: 300 },
        { id: "c", value: 200 },
      ];
      const result = findBestWorst(values, "value");
      expect(result.best).toBe("b");
      expect(result.worst).toBe("a");
    });

    it("handles single item", () => {
      const values = [{ id: "a", value: 100 }];
      const result = findBestWorst(values, "value");
      expect(result.best).toBe("a");
      expect(result.worst).toBe("a");
    });

    it("handles empty array", () => {
      const result = findBestWorst([], "value");
      expect(result.best).toBeNull();
      expect(result.worst).toBeNull();
    });

    it("handles null values", () => {
      const values = [
        { id: "a", value: null },
        { id: "b", value: 300 },
        { id: "c", value: null },
      ];
      const result = findBestWorst(values, "value");
      expect(result.best).toBe("b");
      expect(result.worst).toBe("b");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/services/__tests__/portfolio.test.ts`

Expected: FAIL - module not found

**Step 3: Implement the service**

Create `src/server/services/portfolio.ts`:

```typescript
import type { Transaction } from "../db/schema";

/**
 * Calculate equity (value - total loans)
 */
export function calculateEquity(value: number, totalLoans: number): number {
  return value - totalLoans;
}

/**
 * Calculate Loan-to-Value Ratio as percentage
 * Returns null if no value set (can't divide by zero)
 */
export function calculateLVR(totalLoans: number, value: number): number | null {
  if (value === 0) return null;
  return (totalLoans / value) * 100;
}

/**
 * Calculate cash flow from transactions (income - expenses)
 * Ignores transfer and personal transaction types
 */
export function calculateCashFlow(
  transactions: Pick<Transaction, "amount" | "transactionType">[]
): number {
  return transactions.reduce((sum, t) => {
    if (t.transactionType === "transfer" || t.transactionType === "personal") {
      return sum;
    }
    return sum + Number(t.amount);
  }, 0);
}

/**
 * Calculate gross yield (annual income / value * 100)
 * Returns null if no value set
 */
export function calculateGrossYield(
  annualIncome: number,
  value: number
): number | null {
  if (value === 0) return null;
  return (annualIncome / value) * 100;
}

/**
 * Calculate net yield ((income - expenses) / value * 100)
 * Returns null if no value set
 */
export function calculateNetYield(
  annualIncome: number,
  annualExpenses: number,
  value: number
): number | null {
  if (value === 0) return null;
  return ((annualIncome - annualExpenses) / value) * 100;
}

/**
 * Find best and worst performers from an array of objects
 */
export function findBestWorst<T extends Record<string, any>>(
  items: T[],
  key: keyof T
): { best: string | null; worst: string | null } {
  const validItems = items.filter(
    (item) => item[key] !== null && item[key] !== undefined
  );

  if (validItems.length === 0) {
    return { best: null, worst: null };
  }

  const sorted = [...validItems].sort(
    (a, b) => (b[key] as number) - (a[key] as number)
  );

  return {
    best: sorted[0].id as string,
    worst: sorted[sorted.length - 1].id as string,
  };
}

/**
 * Get date range for period calculations
 */
export function getDateRangeForPeriod(
  period: "monthly" | "quarterly" | "annual"
): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case "monthly":
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case "quarterly":
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case "annual":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  return { startDate, endDate };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/services/__tests__/portfolio.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/server/services/portfolio.ts src/server/services/__tests__/portfolio.test.ts
git commit -m "feat(portfolio): add calculation service with tests"
```

---

### Task 4: Create PropertyValue Router

**Files:**
- Create: `src/server/routers/propertyValue.ts`
- Create: `src/server/routers/__tests__/propertyValue.test.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the failing tests**

Create `src/server/routers/__tests__/propertyValue.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("propertyValue router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperty = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-1",
    address: "123 Main St",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
    purchasePrice: "500000",
    purchaseDate: "2020-01-01",
    entityName: "Personal",
    status: "active",
    soldAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPropertyValue = {
    id: "660e8400-e29b-41d4-a716-446655440001",
    propertyId: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-1",
    estimatedValue: "650000",
    valueDate: "2024-06-01",
    source: "manual",
    notes: "Based on recent sales",
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates a property value entry", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockPropertyValue]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.create({
        propertyId: mockProperty.id,
        estimatedValue: "650000",
        valueDate: "2024-06-01",
        notes: "Based on recent sales",
      });

      expect(result.estimatedValue).toBe("650000");
      expect(ctx.db.insert).toHaveBeenCalled();
    });

    it("throws error if property not found", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);
      await expect(
        caller.propertyValue.create({
          propertyId: "00000000-0000-0000-0000-000000000000",
          estimatedValue: "650000",
          valueDate: "2024-06-01",
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("list", () => {
    it("returns value history for a property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
          propertyValues: {
            findMany: vi.fn().mockResolvedValue([mockPropertyValue]),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.list({
        propertyId: mockProperty.id,
      });

      expect(result).toHaveLength(1);
      expect(result[0].estimatedValue).toBe("650000");
    });
  });

  describe("getLatest", () => {
    it("returns most recent value for a property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          propertyValues: {
            findFirst: vi.fn().mockResolvedValue(mockPropertyValue),
          },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.getLatest({
        propertyId: mockProperty.id,
      });

      expect(result?.estimatedValue).toBe("650000");
    });

    it("returns null if no value exists", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          propertyValues: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.getLatest({
        propertyId: mockProperty.id,
      });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes a property value entry", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.propertyValue.delete({
        id: mockPropertyValue.id,
      });

      expect(result.success).toBe(true);
      expect(ctx.db.delete).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/routers/__tests__/propertyValue.test.ts`

Expected: FAIL - module not found

**Step 3: Implement the router**

Create `src/server/routers/propertyValue.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { propertyValues, properties } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export const propertyValueRouter = router({
  list: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      return ctx.db.query.propertyValues.findMany({
        where: eq(propertyValues.propertyId, input.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
      });
    }),

  getLatest: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.propertyValues.findFirst({
        where: and(
          eq(propertyValues.propertyId, input.propertyId),
          eq(propertyValues.userId, ctx.user.id)
        ),
        orderBy: [desc(propertyValues.valueDate)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        estimatedValue: z.string().regex(/^\d+\.?\d*$/, "Invalid value"),
        valueDate: z.string(),
        source: z.enum(["manual", "api"]).default("manual"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      const [value] = await ctx.db
        .insert(propertyValues)
        .values({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          estimatedValue: input.estimatedValue,
          valueDate: input.valueDate,
          source: input.source,
          notes: input.notes,
        })
        .returning();

      return value;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(propertyValues)
        .where(
          and(
            eq(propertyValues.id, input.id),
            eq(propertyValues.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
```

**Step 4: Register the router**

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
import { documentsRouter } from "./documents";
import { recurringRouter } from "./recurring";
import { propertyValueRouter } from "./propertyValue";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
  loan: loanRouter,
  reports: reportsRouter,
  cgt: cgtRouter,
  documents: documentsRouter,
  recurring: recurringRouter,
  propertyValue: propertyValueRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/routers/__tests__/propertyValue.test.ts`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/server/routers/propertyValue.ts src/server/routers/__tests__/propertyValue.test.ts src/server/routers/_app.ts
git commit -m "feat(router): add propertyValue router with CRUD operations"
```

---

### Task 5: Create Portfolio Router

**Files:**
- Create: `src/server/routers/portfolio.ts`
- Create: `src/server/routers/__tests__/portfolio.test.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the failing tests**

Create `src/server/routers/__tests__/portfolio.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("portfolio router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperties = [
    {
      id: "prop-1",
      userId: "user-1",
      address: "123 Main St",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      purchasePrice: "500000",
      purchaseDate: "2020-01-01",
      entityName: "Personal",
      status: "active",
    },
    {
      id: "prop-2",
      userId: "user-1",
      address: "456 Oak Ave",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000",
      purchasePrice: "600000",
      purchaseDate: "2021-06-01",
      entityName: "Trust",
      status: "active",
    },
  ];

  const mockPropertyValues = [
    { propertyId: "prop-1", estimatedValue: "650000", valueDate: "2024-06-01" },
    { propertyId: "prop-2", estimatedValue: "700000", valueDate: "2024-06-01" },
  ];

  const mockLoans = [
    { propertyId: "prop-1", currentBalance: "300000" },
    { propertyId: "prop-2", currentBalance: "400000" },
  ];

  const mockTransactions = [
    { propertyId: "prop-1", amount: "2400", transactionType: "income", date: "2024-05-01" },
    { propertyId: "prop-1", amount: "-500", transactionType: "expense", date: "2024-05-15" },
    { propertyId: "prop-2", amount: "2800", transactionType: "income", date: "2024-05-01" },
    { propertyId: "prop-2", amount: "-600", transactionType: "expense", date: "2024-05-20" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSummary", () => {
    it("returns aggregated portfolio totals", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          propertyValues: { findMany: vi.fn().mockResolvedValue(mockPropertyValues) },
          loans: { findMany: vi.fn().mockResolvedValue(mockLoans) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getSummary({ period: "monthly" });

      expect(result.propertyCount).toBe(2);
      expect(result.totalValue).toBe(1350000); // 650000 + 700000
      expect(result.totalDebt).toBe(700000); // 300000 + 400000
      expect(result.totalEquity).toBe(650000); // 1350000 - 700000
    });

    it("filters by state", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue([mockProperties[0]]) },
          propertyValues: { findMany: vi.fn().mockResolvedValue([mockPropertyValues[0]]) },
          loans: { findMany: vi.fn().mockResolvedValue([mockLoans[0]]) },
          transactions: { findMany: vi.fn().mockResolvedValue([mockTransactions[0], mockTransactions[1]]) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getSummary({
        period: "monthly",
        state: "NSW",
      });

      expect(result.propertyCount).toBe(1);
      expect(result.totalValue).toBe(650000);
    });
  });

  describe("getPropertyMetrics", () => {
    it("returns metrics for each property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          propertyValues: { findMany: vi.fn().mockResolvedValue(mockPropertyValues) },
          loans: { findMany: vi.fn().mockResolvedValue(mockLoans) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getPropertyMetrics({
        period: "monthly",
        sortBy: "equity",
        sortOrder: "desc",
      });

      expect(result).toHaveLength(2);
      // prop-1: 650000 - 300000 = 350000 equity
      // prop-2: 700000 - 400000 = 300000 equity
      expect(result[0].propertyId).toBe("prop-1"); // Higher equity first
      expect(result[0].equity).toBe(350000);
      expect(result[1].equity).toBe(300000);
    });

    it("sorts by cash flow", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          propertyValues: { findMany: vi.fn().mockResolvedValue(mockPropertyValues) },
          loans: { findMany: vi.fn().mockResolvedValue(mockLoans) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.portfolio.getPropertyMetrics({
        period: "monthly",
        sortBy: "cashFlow",
        sortOrder: "desc",
      });

      // prop-1: 2400 - 500 = 1900
      // prop-2: 2800 - 600 = 2200
      expect(result[0].propertyId).toBe("prop-2"); // Higher cash flow first
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/server/routers/__tests__/portfolio.test.ts`

Expected: FAIL - module not found

**Step 3: Implement the router**

Create `src/server/routers/portfolio.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { properties, propertyValues, loans, transactions } from "../db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import {
  calculateEquity,
  calculateLVR,
  calculateCashFlow,
  calculateGrossYield,
  calculateNetYield,
  getDateRangeForPeriod,
} from "../services/portfolio";

const periodSchema = z.enum(["monthly", "quarterly", "annual"]);
const sortBySchema = z.enum(["cashFlow", "equity", "lvr", "alphabetical"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

const filtersSchema = z.object({
  period: periodSchema,
  state: z.string().optional(),
  entityType: z.string().optional(),
  status: z.enum(["active", "sold"]).optional(),
});

export const portfolioRouter = router({
  getSummary: protectedProcedure
    .input(filtersSchema)
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = getDateRangeForPeriod(input.period);

      // Get filtered properties
      let propertyList = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.user.id),
      });

      // Apply filters
      if (input.state) {
        propertyList = propertyList.filter((p) => p.state === input.state);
      }
      if (input.entityType) {
        propertyList = propertyList.filter((p) => p.entityName === input.entityType);
      }
      if (input.status) {
        propertyList = propertyList.filter((p) => p.status === input.status);
      }

      if (propertyList.length === 0) {
        return {
          propertyCount: 0,
          totalValue: 0,
          totalDebt: 0,
          totalEquity: 0,
          portfolioLVR: null,
          cashFlow: 0,
          averageYield: null,
        };
      }

      const propertyIds = propertyList.map((p) => p.id);

      // Get latest values for each property
      const allValues = await ctx.db.query.propertyValues.findMany({
        where: and(
          eq(propertyValues.userId, ctx.user.id),
          inArray(propertyValues.propertyId, propertyIds)
        ),
        orderBy: [desc(propertyValues.valueDate)],
      });

      // Get latest value per property
      const latestValues = new Map<string, number>();
      for (const v of allValues) {
        if (!latestValues.has(v.propertyId)) {
          latestValues.set(v.propertyId, Number(v.estimatedValue));
        }
      }

      // Get all loans
      const allLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, ctx.user.id),
          inArray(loans.propertyId, propertyIds)
        ),
      });

      // Sum loans per property
      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Get transactions in period
      const periodTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.user.id),
          inArray(transactions.propertyId, propertyIds),
          gte(transactions.date, startDate.toISOString().split("T")[0]),
          lte(transactions.date, endDate.toISOString().split("T")[0])
        ),
      });

      // Calculate totals
      const totalValue = Array.from(latestValues.values()).reduce((a, b) => a + b, 0);
      const totalDebt = Array.from(loansByProperty.values()).reduce((a, b) => a + b, 0);
      const totalEquity = calculateEquity(totalValue, totalDebt);
      const portfolioLVR = calculateLVR(totalDebt, totalValue);
      const cashFlow = calculateCashFlow(periodTransactions);

      // Calculate average yield (weighted by value)
      let totalAnnualIncome = 0;
      const incomeTransactions = periodTransactions.filter(
        (t) => t.transactionType === "income"
      );
      const periodIncome = incomeTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
      // Annualize based on period
      const multiplier = input.period === "monthly" ? 12 : input.period === "quarterly" ? 4 : 1;
      totalAnnualIncome = periodIncome * multiplier;

      const averageYield = calculateGrossYield(totalAnnualIncome, totalValue);

      return {
        propertyCount: propertyList.length,
        totalValue,
        totalDebt,
        totalEquity,
        portfolioLVR,
        cashFlow,
        averageYield,
      };
    }),

  getPropertyMetrics: protectedProcedure
    .input(
      filtersSchema.extend({
        sortBy: sortBySchema.default("alphabetical"),
        sortOrder: sortOrderSchema.default("asc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = getDateRangeForPeriod(input.period);

      // Get filtered properties
      let propertyList = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.user.id),
      });

      if (input.state) {
        propertyList = propertyList.filter((p) => p.state === input.state);
      }
      if (input.entityType) {
        propertyList = propertyList.filter((p) => p.entityName === input.entityType);
      }
      if (input.status) {
        propertyList = propertyList.filter((p) => p.status === input.status);
      }

      if (propertyList.length === 0) {
        return [];
      }

      const propertyIds = propertyList.map((p) => p.id);

      // Get latest values
      const allValues = await ctx.db.query.propertyValues.findMany({
        where: and(
          eq(propertyValues.userId, ctx.user.id),
          inArray(propertyValues.propertyId, propertyIds)
        ),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const latestValues = new Map<string, number>();
      for (const v of allValues) {
        if (!latestValues.has(v.propertyId)) {
          latestValues.set(v.propertyId, Number(v.estimatedValue));
        }
      }

      // Get all loans
      const allLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, ctx.user.id),
          inArray(loans.propertyId, propertyIds)
        ),
      });

      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Get transactions in period
      const periodTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.user.id),
          inArray(transactions.propertyId, propertyIds),
          gte(transactions.date, startDate.toISOString().split("T")[0]),
          lte(transactions.date, endDate.toISOString().split("T")[0])
        ),
      });

      // Group transactions by property
      const transactionsByProperty = new Map<string, typeof periodTransactions>();
      for (const t of periodTransactions) {
        if (t.propertyId) {
          const list = transactionsByProperty.get(t.propertyId) || [];
          list.push(t);
          transactionsByProperty.set(t.propertyId, list);
        }
      }

      // Calculate metrics for each property
      const multiplier = input.period === "monthly" ? 12 : input.period === "quarterly" ? 4 : 1;

      const metrics = propertyList.map((property) => {
        const value = latestValues.get(property.id) || 0;
        const totalLoans = loansByProperty.get(property.id) || 0;
        const propertyTransactions = transactionsByProperty.get(property.id) || [];

        const equity = calculateEquity(value, totalLoans);
        const lvr = calculateLVR(totalLoans, value);
        const cashFlow = calculateCashFlow(propertyTransactions);

        const income = propertyTransactions
          .filter((t) => t.transactionType === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const expenses = propertyTransactions
          .filter((t) => t.transactionType === "expense")
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

        const annualIncome = income * multiplier;
        const annualExpenses = expenses * multiplier;

        const grossYield = calculateGrossYield(annualIncome, value);
        const netYield = calculateNetYield(annualIncome, annualExpenses, value);

        const capitalGrowth = value - Number(property.purchasePrice);
        const capitalGrowthPercent =
          Number(property.purchasePrice) > 0
            ? (capitalGrowth / Number(property.purchasePrice)) * 100
            : 0;

        return {
          propertyId: property.id,
          address: property.address,
          suburb: property.suburb,
          state: property.state,
          entityName: property.entityName,
          status: property.status,
          purchasePrice: Number(property.purchasePrice),
          currentValue: value,
          capitalGrowth,
          capitalGrowthPercent,
          totalLoans,
          equity,
          lvr,
          grossYield,
          netYield,
          cashFlow,
          annualIncome,
          annualExpenses,
          hasValue: value > 0,
        };
      });

      // Sort
      metrics.sort((a, b) => {
        let comparison = 0;
        switch (input.sortBy) {
          case "cashFlow":
            comparison = a.cashFlow - b.cashFlow;
            break;
          case "equity":
            comparison = a.equity - b.equity;
            break;
          case "lvr":
            comparison = (a.lvr ?? 0) - (b.lvr ?? 0);
            break;
          case "alphabetical":
            comparison = a.suburb.localeCompare(b.suburb);
            break;
        }
        return input.sortOrder === "desc" ? -comparison : comparison;
      });

      return metrics;
    }),
});
```

**Step 4: Register the router**

Add to `src/server/routers/_app.ts`:

```typescript
import { portfolioRouter } from "./portfolio";

// In appRouter:
portfolio: portfolioRouter,
```

**Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- src/server/routers/__tests__/portfolio.test.ts`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/server/routers/portfolio.ts src/server/routers/__tests__/portfolio.test.ts src/server/routers/_app.ts
git commit -m "feat(router): add portfolio router with getSummary and getPropertyMetrics"
```

---

### Task 6: Install Tremor and Create Chart Components

**Files:**
- Modify: `package.json`
- Create: `src/components/portfolio/EquityDonutChart.tsx`
- Create: `src/components/portfolio/CashFlowBarChart.tsx`

**Step 1: Install Tremor**

Run: `npm install @tremor/react`

**Step 2: Create EquityDonutChart component**

Create `src/components/portfolio/EquityDonutChart.tsx`:

```typescript
"use client";

import { DonutChart } from "@tremor/react";

interface EquityData {
  name: string;
  value: number;
}

interface EquityDonutChartProps {
  data: EquityData[];
}

export function EquityDonutChart({ data }: EquityDonutChartProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No equity data available
      </div>
    );
  }

  return (
    <DonutChart
      data={data}
      category="value"
      index="name"
      valueFormatter={formatCurrency}
      className="h-[300px]"
      colors={["blue", "cyan", "indigo", "violet", "fuchsia"]}
    />
  );
}
```

**Step 3: Create CashFlowBarChart component**

Create `src/components/portfolio/CashFlowBarChart.tsx`:

```typescript
"use client";

import { BarChart } from "@tremor/react";

interface CashFlowData {
  name: string;
  cashFlow: number;
}

interface CashFlowBarChartProps {
  data: CashFlowData[];
}

export function CashFlowBarChart({ data }: CashFlowBarChartProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No cash flow data available
      </div>
    );
  }

  return (
    <BarChart
      data={data}
      index="name"
      categories={["cashFlow"]}
      colors={["emerald"]}
      valueFormatter={formatCurrency}
      className="h-[300px]"
      showLegend={false}
    />
  );
}
```

**Step 4: Commit**

```bash
git add package.json package-lock.json src/components/portfolio/
git commit -m "feat(ui): add Tremor charts for portfolio view"
```

---

### Task 7: Create Portfolio Page with Cards View

**Files:**
- Create: `src/app/(dashboard)/portfolio/page.tsx`
- Create: `src/components/portfolio/PortfolioToolbar.tsx`
- Create: `src/components/portfolio/PortfolioCard.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Create PortfolioToolbar component**

Create `src/components/portfolio/PortfolioToolbar.tsx`:

```typescript
"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, Table2, PieChart } from "lucide-react";

type ViewMode = "cards" | "table" | "aggregate";
type Period = "monthly" | "quarterly" | "annual";
type SortBy = "cashFlow" | "equity" | "lvr" | "alphabetical";

interface PortfolioToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  period: Period;
  onPeriodChange: (period: Period) => void;
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
  stateFilter?: string;
  onStateFilterChange: (state: string | undefined) => void;
  statusFilter?: string;
  onStatusFilterChange: (status: string | undefined) => void;
}

const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

export function PortfolioToolbar({
  viewMode,
  onViewModeChange,
  period,
  onPeriodChange,
  sortBy,
  onSortByChange,
  stateFilter,
  onStateFilterChange,
  statusFilter,
  onStatusFilterChange,
}: PortfolioToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 border rounded-lg p-1">
        <Button
          variant={viewMode === "cards" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("cards")}
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("table")}
        >
          <Table2 className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "aggregate" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("aggregate")}
        >
          <PieChart className="w-4 h-4" />
        </Button>
      </div>

      {/* Period Selector */}
      <Select value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="quarterly">Quarterly</SelectItem>
          <SelectItem value="annual">Annual</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort By */}
      {viewMode !== "aggregate" && (
        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortBy)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alphabetical">A-Z</SelectItem>
            <SelectItem value="cashFlow">Cash Flow</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="lvr">LVR</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* State Filter */}
      <Select
        value={stateFilter || "all"}
        onValueChange={(v) => onStateFilterChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="State" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All States</SelectItem>
          {states.map((state) => (
            <SelectItem key={state} value={state}>
              {state}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={statusFilter || "all"}
        onValueChange={(v) => onStatusFilterChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="sold">Sold</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 2: Create PortfolioCard component**

Create `src/components/portfolio/PortfolioCard.tsx`:

```typescript
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyMetrics {
  propertyId: string;
  address: string;
  suburb: string;
  state: string;
  entityName: string;
  currentValue: number;
  totalLoans: number;
  equity: number;
  lvr: number | null;
  cashFlow: number;
  hasValue: boolean;
}

interface PortfolioCardProps {
  property: PropertyMetrics;
  onUpdateValue: (propertyId: string) => void;
}

export function PortfolioCard({ property, onUpdateValue }: PortfolioCardProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number | null) =>
    value !== null ? `${value.toFixed(1)}%` : "-";

  const getLVRColor = (lvr: number | null) => {
    if (lvr === null) return "text-muted-foreground";
    if (lvr < 60) return "text-green-600";
    if (lvr < 80) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Link href={`/properties/${property.propertyId}`} className="flex items-center gap-2 hover:underline">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{property.address}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {property.suburb}, {property.state}
              </div>
            </div>
          </Link>
          <Badge variant="secondary">{property.entityName}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!property.hasValue && (
          <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-yellow-50 text-yellow-800 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>No value set</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-yellow-800 underline"
              onClick={() => onUpdateValue(property.propertyId)}
            >
              Add value
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="text-lg font-semibold">
              {property.hasValue ? formatCurrency(property.currentValue) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Loan Balance</p>
            <p className="text-lg font-semibold">{formatCurrency(property.totalLoans)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Equity</p>
            <p className="text-lg font-semibold">
              {property.hasValue ? formatCurrency(property.equity) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">LVR</p>
            <p className={cn("text-lg font-semibold", getLVRColor(property.lvr))}>
              {formatPercent(property.lvr)}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cash Flow</span>
            <div className="flex items-center gap-1">
              {property.cashFlow >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={cn(
                  "font-semibold",
                  property.cashFlow >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(property.cashFlow)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create Portfolio page**

Create `src/app/(dashboard)/portfolio/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PortfolioToolbar } from "@/components/portfolio/PortfolioToolbar";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { AddPropertyValueDialog } from "@/components/portfolio/AddPropertyValueDialog";
import { trpc } from "@/lib/trpc/client";
import { Plus, Building2 } from "lucide-react";

type ViewMode = "cards" | "table" | "aggregate";
type Period = "monthly" | "quarterly" | "annual";
type SortBy = "cashFlow" | "equity" | "lvr" | "alphabetical";

export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewMode = (searchParams.get("view") as ViewMode) || "cards";
  const period = (searchParams.get("period") as Period) || "monthly";
  const sortBy = (searchParams.get("sortBy") as SortBy) || "alphabetical";
  const stateFilter = searchParams.get("state") || undefined;
  const statusFilter = searchParams.get("status") || undefined;

  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/portfolio?${params.toString()}`);
  };

  const { data: metrics, isLoading, refetch } = trpc.portfolio.getPropertyMetrics.useQuery({
    period,
    sortBy,
    sortOrder: "desc",
    state: stateFilter,
    status: statusFilter as "active" | "sold" | undefined,
  });

  const handleUpdateValue = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setValueDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground">Overview of your investment properties</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground">Overview of your investment properties</p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Link>
        </Button>
      </div>

      <PortfolioToolbar
        viewMode={viewMode}
        onViewModeChange={(mode) => updateParams({ view: mode })}
        period={period}
        onPeriodChange={(p) => updateParams({ period: p })}
        sortBy={sortBy}
        onSortByChange={(s) => updateParams({ sortBy: s })}
        stateFilter={stateFilter}
        onStateFilterChange={(s) => updateParams({ state: s })}
        statusFilter={statusFilter}
        onStatusFilterChange={(s) => updateParams({ status: s })}
      />

      {viewMode === "cards" && (
        <>
          {metrics && metrics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {metrics.map((property) => (
                <PortfolioCard
                  key={property.propertyId}
                  property={property}
                  onUpdateValue={handleUpdateValue}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">No properties yet</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                Add your first investment property to start tracking your portfolio.
              </p>
              <Button asChild className="mt-4">
                <Link href="/properties/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Property
                </Link>
              </Button>
            </div>
          )}
        </>
      )}

      {viewMode === "table" && (
        <div className="text-center py-12 text-muted-foreground">
          Comparison table view - implemented in Task 8
        </div>
      )}

      {viewMode === "aggregate" && (
        <div className="text-center py-12 text-muted-foreground">
          Aggregated totals view - implemented in Task 9
        </div>
      )}

      <AddPropertyValueDialog
        open={valueDialogOpen}
        onOpenChange={setValueDialogOpen}
        propertyId={selectedPropertyId}
        onSuccess={() => {
          refetch();
          setValueDialogOpen(false);
        }}
      />
    </div>
  );
}
```

**Step 4: Create AddPropertyValueDialog**

Create `src/components/portfolio/AddPropertyValueDialog.tsx`:

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const formSchema = z.object({
  estimatedValue: z.string().regex(/^\d+\.?\d*$/, "Invalid value"),
  valueDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddPropertyValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string | null;
  onSuccess: () => void;
}

export function AddPropertyValueDialog({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: AddPropertyValueDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      estimatedValue: "",
      valueDate: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const createValue = trpc.propertyValue.create.useMutation({
    onSuccess: () => {
      toast.success("Property value updated");
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update value");
    },
  });

  const handleSubmit = (values: FormValues) => {
    if (!propertyId) return;

    createValue.mutate({
      propertyId,
      estimatedValue: values.estimatedValue,
      valueDate: values.valueDate,
      notes: values.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Property Value</DialogTitle>
          <DialogDescription>
            Enter the current estimated value of this property.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Value ($)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="650000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>As of Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Based on recent comparable sales"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createValue.isPending}
              >
                {createValue.isPending ? "Saving..." : "Save Value"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 5: Update Sidebar**

Modify `src/components/layout/Sidebar.tsx` to add Portfolio above Properties:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  BarChart3,
  Landmark,
  Wallet,
  FileDown,
  PieChart,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/banking", label: "Banking", icon: Landmark },
  { href: "/loans", label: "Loans", icon: Wallet },
  { href: "/export", label: "Export", icon: FileDown },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card min-h-screen p-4">
      <div className="mb-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">PropertyTracker</span>
        </Link>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/portfolio/ src/components/portfolio/ src/components/layout/Sidebar.tsx
git commit -m "feat(ui): add portfolio page with cards view"
```

---

### Task 8: Add Comparison Table View

**Files:**
- Create: `src/components/portfolio/ComparisonTable.tsx`
- Modify: `src/app/(dashboard)/portfolio/page.tsx`

**Step 1: Create ComparisonTable component**

Create `src/components/portfolio/ComparisonTable.tsx`:

```typescript
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { findBestWorst } from "@/server/services/portfolio";

interface PropertyMetrics {
  propertyId: string;
  address: string;
  suburb: string;
  state: string;
  purchasePrice: number;
  currentValue: number;
  capitalGrowth: number;
  capitalGrowthPercent: number;
  totalLoans: number;
  equity: number;
  lvr: number | null;
  grossYield: number | null;
  netYield: number | null;
  cashFlow: number;
  annualIncome: number;
  annualExpenses: number;
  hasValue: boolean;
}

interface ComparisonTableProps {
  properties: PropertyMetrics[];
  onExport: () => void;
}

const metrics = [
  { key: "purchasePrice", label: "Purchase Price", format: "currency" },
  { key: "currentValue", label: "Current Value", format: "currency" },
  { key: "capitalGrowth", label: "Capital Growth ($)", format: "currency" },
  { key: "capitalGrowthPercent", label: "Capital Growth (%)", format: "percent" },
  { key: "totalLoans", label: "Loan Balance", format: "currency" },
  { key: "equity", label: "Equity", format: "currency" },
  { key: "lvr", label: "LVR", format: "percent" },
  { key: "grossYield", label: "Gross Yield", format: "percent" },
  { key: "netYield", label: "Net Yield", format: "percent" },
  { key: "cashFlow", label: "Cash Flow", format: "currency" },
  { key: "annualIncome", label: "Annual Income", format: "currency" },
  { key: "annualExpenses", label: "Annual Expenses", format: "currency" },
] as const;

export function ComparisonTable({ properties, onExport }: ComparisonTableProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number | null) =>
    value !== null ? `${value.toFixed(1)}%` : "-";

  const formatValue = (value: any, format: string) => {
    if (value === null || value === undefined) return "-";
    if (format === "currency") return formatCurrency(value);
    if (format === "percent") return formatPercent(value);
    return String(value);
  };

  // Calculate best/worst for each metric
  const bestWorstByMetric = metrics.reduce(
    (acc, metric) => {
      const values = properties.map((p) => ({
        id: p.propertyId,
        value: p[metric.key as keyof PropertyMetrics] as number | null,
      }));
      acc[metric.key] = findBestWorst(values, "value");
      return acc;
    },
    {} as Record<string, { best: string | null; worst: string | null }>
  );

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No properties to compare
      </div>
    );
  }

  // Mobile warning
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (isMobile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Comparison table works best on larger screens
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Switch to Cards View
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 bg-muted/50 p-3 text-left font-medium min-w-[150px]">
                Metric
              </th>
              {properties.map((property) => (
                <th key={property.propertyId} className="p-3 text-left font-medium min-w-[140px]">
                  <Link
                    href={`/properties/${property.propertyId}`}
                    className="hover:underline"
                  >
                    {property.suburb}
                  </Link>
                  <div className="text-xs font-normal text-muted-foreground">
                    {property.state}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.key} className="border-t">
                <td className="sticky left-0 bg-card p-3 font-medium">
                  {metric.label}
                </td>
                {properties.map((property) => {
                  const value = property[metric.key as keyof PropertyMetrics];
                  const { best, worst } = bestWorstByMetric[metric.key];
                  const isBest = best === property.propertyId && properties.length > 1;
                  const isWorst = worst === property.propertyId && best !== worst;

                  return (
                    <td
                      key={property.propertyId}
                      className={cn(
                        "p-3",
                        isBest && "bg-green-50 text-green-700",
                        isWorst && "bg-red-50 text-red-700"
                      )}
                    >
                      {formatValue(value, metric.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Update portfolio page to include table view**

In `src/app/(dashboard)/portfolio/page.tsx`, replace the table placeholder with:

```typescript
{viewMode === "table" && metrics && (
  <ComparisonTable
    properties={metrics}
    onExport={() => {
      // Generate CSV
      const headers = ["Property", "Purchase Price", "Current Value", "Equity", "LVR", "Cash Flow"];
      const rows = metrics.map((p) => [
        `${p.suburb}, ${p.state}`,
        p.purchasePrice,
        p.currentValue,
        p.equity,
        p.lvr?.toFixed(1) ?? "",
        p.cashFlow,
      ]);
      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "portfolio-comparison.csv";
      a.click();
    }}
  />
)}
```

Add the import at the top:

```typescript
import { ComparisonTable } from "@/components/portfolio/ComparisonTable";
```

**Step 3: Commit**

```bash
git add src/components/portfolio/ComparisonTable.tsx src/app/\(dashboard\)/portfolio/page.tsx
git commit -m "feat(ui): add portfolio comparison table view"
```

---

### Task 9: Add Aggregated Totals View

**Files:**
- Create: `src/components/portfolio/AggregatedView.tsx`
- Modify: `src/app/(dashboard)/portfolio/page.tsx`

**Step 1: Create AggregatedView component**

Create `src/components/portfolio/AggregatedView.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EquityDonutChart } from "./EquityDonutChart";
import { CashFlowBarChart } from "./CashFlowBarChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Building2, DollarSign, TrendingUp, Percent, Hash } from "lucide-react";

interface PortfolioSummary {
  propertyCount: number;
  totalValue: number;
  totalDebt: number;
  totalEquity: number;
  portfolioLVR: number | null;
  cashFlow: number;
  averageYield: number | null;
}

interface PropertyMetrics {
  propertyId: string;
  suburb: string;
  state: string;
  currentValue: number;
  equity: number;
  cashFlow: number;
  lvr: number | null;
}

interface AggregatedViewProps {
  summary: PortfolioSummary;
  properties: PropertyMetrics[];
  period: string;
}

export function AggregatedView({ summary, properties, period }: AggregatedViewProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number | null) =>
    value !== null ? `${value.toFixed(1)}%` : "-";

  const periodLabel = period === "monthly" ? "Monthly" : period === "quarterly" ? "Quarterly" : "Annual";

  // Prepare chart data
  const equityData = properties
    .filter((p) => p.equity > 0)
    .map((p) => ({
      name: `${p.suburb}, ${p.state}`,
      value: p.equity,
    }));

  const cashFlowData = properties.map((p) => ({
    name: p.suburb,
    cashFlow: p.cashFlow,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Portfolio Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Debt
            </CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalDebt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Equity
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalEquity)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio LVR
            </CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPercent(summary.portfolioLVR)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Properties
            </CardTitle>
            <Hash className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.propertyCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {periodLabel} Cash Flow
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.cashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(summary.cashFlow)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Yield
            </CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPercent(summary.averageYield)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Equity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityDonutChart data={equityData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow by Property</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowBarChart data={cashFlowData} />
          </CardContent>
        </Card>
      </div>

      {/* Property Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Property Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead className="text-right">LVR</TableHead>
                <TableHead className="text-right">Cash Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.propertyId}>
                  <TableCell>
                    <Link
                      href={`/properties/${property.propertyId}`}
                      className="hover:underline font-medium"
                    >
                      {property.suburb}, {property.state}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(property.currentValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(property.equity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercent(property.lvr)}
                  </TableCell>
                  <TableCell className={`text-right ${property.cashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(property.cashFlow)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Update portfolio page to include aggregate view**

In `src/app/(dashboard)/portfolio/page.tsx`, add the summary query and replace the aggregate placeholder:

Add new query:

```typescript
const { data: summary } = trpc.portfolio.getSummary.useQuery({
  period,
  state: stateFilter,
  status: statusFilter as "active" | "sold" | undefined,
});
```

Replace the aggregate placeholder with:

```typescript
{viewMode === "aggregate" && summary && metrics && (
  <AggregatedView
    summary={summary}
    properties={metrics}
    period={period}
  />
)}
```

Add the import:

```typescript
import { AggregatedView } from "@/components/portfolio/AggregatedView";
```

**Step 3: Commit**

```bash
git add src/components/portfolio/AggregatedView.tsx src/app/\(dashboard\)/portfolio/page.tsx
git commit -m "feat(ui): add portfolio aggregated totals view with charts"
```

---

### Task 10: Run All Tests and Fix Issues

**Step 1: Run unit tests**

Run: `npm run test:unit`

Expected: All tests pass

**Step 2: Run lint**

Run: `npm run lint`

Expected: No errors

**Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds

**Step 4: Fix any issues found**

Address any test failures, lint errors, or build errors.

**Step 5: Commit fixes if any**

```bash
git add -A
git commit -m "fix: address test and build issues"
```

---

### Task 11: Final Commit and Push

**Step 1: Verify all changes**

Run: `git status`

Run: `git log --oneline -10`

**Step 2: Push to remote**

Run: `git push origin feature/infrastructure`

---

## Summary

This plan implements the Multi-Property Portfolio View with:

1. **Data layer**: `propertyValues` table, `propertyValue` router, `portfolio` router
2. **Service layer**: Portfolio calculation functions with tests
3. **UI layer**: Three view modes (cards, table, aggregate) with Tremor charts
4. **Navigation**: Portfolio added to sidebar above Properties

Total tasks: 11
