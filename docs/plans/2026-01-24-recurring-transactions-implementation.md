# Recurring Transactions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to define expected recurring transactions, auto-match them against bank imports, and receive alerts when expected transactions don't arrive.

**Architecture:** Two-table design (templates + generated instances). Daily cron generates expected transactions, matching runs on bank sync. Confidence scoring for auto-match vs manual review.

**Tech Stack:** Drizzle ORM, tRPC, Vercel Cron, Resend for email.

---

### Task 1: Add enums and tables to schema

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add frequency and expected status enums**

Add after `documentCategoryEnum`:

```typescript
export const frequencyEnum = pgEnum("frequency", [
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "annually",
]);

export const expectedStatusEnum = pgEnum("expected_status", [
  "pending",
  "matched",
  "missed",
  "skipped",
]);
```

**Step 2: Add recurringTransactions table**

Add after `documents` table:

```typescript
export const recurringTransactions = pgTable("recurring_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),

  // Template details
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: categoryEnum("category").notNull(),
  transactionType: transactionTypeEnum("transaction_type").notNull(),

  // Frequency
  frequency: frequencyEnum("frequency").notNull(),
  dayOfMonth: integer("day_of_month"), // 1-31
  dayOfWeek: integer("day_of_week"), // 0-6
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),

  // Matching config
  linkedBankAccountId: uuid("linked_bank_account_id").references(
    () => bankAccounts.id,
    { onDelete: "set null" }
  ),
  amountTolerance: decimal("amount_tolerance", { precision: 5, scale: 2 })
    .default("5.00")
    .notNull(),
  dateTolerance: integer("date_tolerance").default(3).notNull(),
  alertDelayDays: integer("alert_delay_days").default(3).notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Step 3: Add expectedTransactions table**

Add after `recurringTransactions`:

```typescript
export const expectedTransactions = pgTable(
  "expected_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringTransactionId: uuid("recurring_transaction_id")
      .references(() => recurringTransactions.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),

    expectedDate: date("expected_date").notNull(),
    expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),

    status: expectedStatusEnum("status").default("pending").notNull(),
    matchedTransactionId: uuid("matched_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" }
    ),
    matchConfidence: text("match_confidence"), // "high" | "medium" | null

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("expected_transactions_user_id_idx").on(table.userId),
    index("expected_transactions_status_idx").on(table.status),
    index("expected_transactions_expected_date_idx").on(table.expectedDate),
  ]
);
```

**Step 4: Add relations**

Add after `documentsRelations`:

```typescript
export const recurringTransactionsRelations = relations(
  recurringTransactions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [recurringTransactions.userId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [recurringTransactions.propertyId],
      references: [properties.id],
    }),
    linkedBankAccount: one(bankAccounts, {
      fields: [recurringTransactions.linkedBankAccountId],
      references: [bankAccounts.id],
    }),
    expectedTransactions: many(expectedTransactions),
  })
);

export const expectedTransactionsRelations = relations(
  expectedTransactions,
  ({ one }) => ({
    recurringTransaction: one(recurringTransactions, {
      fields: [expectedTransactions.recurringTransactionId],
      references: [recurringTransactions.id],
    }),
    user: one(users, {
      fields: [expectedTransactions.userId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [expectedTransactions.propertyId],
      references: [properties.id],
    }),
    matchedTransaction: one(transactions, {
      fields: [expectedTransactions.matchedTransactionId],
      references: [transactions.id],
    }),
  })
);
```

**Step 5: Add type exports**

Add after `NewDocument`:

```typescript
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type ExpectedTransaction = typeof expectedTransactions.$inferSelect;
export type NewExpectedTransaction = typeof expectedTransactions.$inferInsert;
```

**Step 6: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(schema): add recurring and expected transactions tables"
```

---

### Task 2: Generate and apply database migration

**Files:**
- Create: `drizzle/XXXX_recurring_transactions.sql` (auto-generated)

**Step 1: Generate migration**

Run: `npx drizzle-kit generate`
Expected: Migration file created

**Step 2: Apply migration**

Run: `DATABASE_URL="..." npx drizzle-kit push --force`
Expected: Schema changes applied

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "chore(db): add migration for recurring transactions"
```

---

### Task 3: Create recurring transactions service with generation logic

**Files:**
- Create: `src/server/services/recurring.ts`
- Create: `src/server/services/__tests__/recurring.test.ts`

**Step 1: Create the service file**

Create `src/server/services/recurring.ts`:

```typescript
import { addDays, addWeeks, addMonths, addQuarters, addYears, isBefore, isAfter, startOfDay } from "date-fns";

export type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";

export interface RecurringTemplate {
  id: string;
  frequency: Frequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  startDate: string;
  endDate: string | null;
  amount: string;
  isActive: boolean;
}

export interface ExpectedTransaction {
  recurringTransactionId: string;
  expectedDate: string;
  expectedAmount: string;
}

/**
 * Calculate the next occurrence date based on frequency
 */
export function getNextOccurrence(
  currentDate: Date,
  frequency: Frequency,
  dayOfMonth: number | null,
  dayOfWeek: number | null
): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(currentDate, 1);
    case "fortnightly":
      return addWeeks(currentDate, 2);
    case "monthly":
      const nextMonth = addMonths(currentDate, 1);
      if (dayOfMonth) {
        const lastDayOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
        const day = Math.min(dayOfMonth, lastDayOfMonth);
        return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);
      }
      return nextMonth;
    case "quarterly":
      return addQuarters(currentDate, 1);
    case "annually":
      return addYears(currentDate, 1);
    default:
      return addMonths(currentDate, 1);
  }
}

/**
 * Generate expected transactions for a recurring template
 * Returns dates for the next N days that don't already exist
 */
export function generateExpectedDates(
  template: RecurringTemplate,
  existingDates: Set<string>,
  daysAhead: number = 14
): string[] {
  if (!template.isActive) return [];

  const results: string[] = [];
  const today = startOfDay(new Date());
  const endWindow = addDays(today, daysAhead);
  const startDate = new Date(template.startDate);
  const endDate = template.endDate ? new Date(template.endDate) : null;

  // Start from template start date or today, whichever is later
  let currentDate = isBefore(startDate, today) ? today : startDate;

  // Find the first occurrence on or after currentDate
  if (template.frequency === "monthly" && template.dayOfMonth) {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), template.dayOfMonth);
    if (isBefore(currentDate, today)) {
      currentDate = addMonths(currentDate, 1);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const day = Math.min(template.dayOfMonth, lastDayOfMonth);
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    }
  }

  // Generate dates within the window
  while (isBefore(currentDate, endWindow) || currentDate.getTime() === endWindow.getTime()) {
    // Check end date
    if (endDate && isAfter(currentDate, endDate)) break;

    const dateStr = currentDate.toISOString().split("T")[0];

    // Only add if not already existing
    if (!existingDates.has(dateStr)) {
      results.push(dateStr);
    }

    currentDate = getNextOccurrence(currentDate, template.frequency, template.dayOfMonth, template.dayOfWeek);
  }

  return results;
}

/**
 * Match confidence scoring
 */
export type MatchConfidence = "high" | "medium" | "low";

export interface MatchCandidate {
  transactionId: string;
  amount: number;
  date: string;
  confidence: MatchConfidence;
  amountDiff: number;
  dateDiff: number;
}

export function calculateMatchConfidence(
  expectedAmount: number,
  actualAmount: number,
  expectedDate: string,
  actualDate: string,
  amountTolerance: number,
  dateTolerance: number
): MatchConfidence | null {
  const amountDiff = Math.abs((actualAmount - expectedAmount) / expectedAmount) * 100;
  const dateDiff = Math.abs(
    (new Date(actualDate).getTime() - new Date(expectedDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Outside tolerances = no match
  if (amountDiff > amountTolerance || dateDiff > dateTolerance) {
    return null;
  }

  // High confidence: amount within 1%, date within 2 days
  if (amountDiff <= 1 && dateDiff <= 2) {
    return "high";
  }

  // Medium confidence: within configured tolerances
  return "medium";
}

/**
 * Find best match from candidates
 */
export function findBestMatch(
  expectedAmount: number,
  expectedDate: string,
  candidates: Array<{ id: string; amount: string; date: string }>,
  amountTolerance: number,
  dateTolerance: number
): MatchCandidate | null {
  let bestMatch: MatchCandidate | null = null;

  for (const candidate of candidates) {
    const actualAmount = Math.abs(Number(candidate.amount));
    const confidence = calculateMatchConfidence(
      expectedAmount,
      actualAmount,
      expectedDate,
      candidate.date,
      amountTolerance,
      dateTolerance
    );

    if (!confidence) continue;

    const amountDiff = Math.abs((actualAmount - expectedAmount) / expectedAmount) * 100;
    const dateDiff = Math.abs(
      (new Date(candidate.date).getTime() - new Date(expectedDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Prefer higher confidence, then closer date, then closer amount
    if (
      !bestMatch ||
      (confidence === "high" && bestMatch.confidence !== "high") ||
      (confidence === bestMatch.confidence && dateDiff < bestMatch.dateDiff) ||
      (confidence === bestMatch.confidence && dateDiff === bestMatch.dateDiff && amountDiff < bestMatch.amountDiff)
    ) {
      bestMatch = {
        transactionId: candidate.id,
        amount: actualAmount,
        date: candidate.date,
        confidence,
        amountDiff,
        dateDiff,
      };
    }
  }

  return bestMatch;
}
```

**Step 2: Create test file**

Create `src/server/services/__tests__/recurring.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  generateExpectedDates,
  calculateMatchConfidence,
  findBestMatch,
  getNextOccurrence,
} from "../recurring";

describe("recurring service", () => {
  describe("getNextOccurrence", () => {
    it("adds 1 week for weekly frequency", () => {
      const date = new Date("2026-01-15");
      const next = getNextOccurrence(date, "weekly", null, null);
      expect(next.toISOString().split("T")[0]).toBe("2026-01-22");
    });

    it("adds 2 weeks for fortnightly frequency", () => {
      const date = new Date("2026-01-15");
      const next = getNextOccurrence(date, "fortnightly", null, null);
      expect(next.toISOString().split("T")[0]).toBe("2026-01-29");
    });

    it("adds 1 month for monthly frequency", () => {
      const date = new Date("2026-01-15");
      const next = getNextOccurrence(date, "monthly", 15, null);
      expect(next.toISOString().split("T")[0]).toBe("2026-02-15");
    });

    it("handles month-end edge case (31st in Feb)", () => {
      const date = new Date("2026-01-31");
      const next = getNextOccurrence(date, "monthly", 31, null);
      // Feb 2026 has 28 days
      expect(next.toISOString().split("T")[0]).toBe("2026-02-28");
    });

    it("adds 3 months for quarterly frequency", () => {
      const date = new Date("2026-01-15");
      const next = getNextOccurrence(date, "quarterly", null, null);
      expect(next.toISOString().split("T")[0]).toBe("2026-04-15");
    });

    it("adds 1 year for annually frequency", () => {
      const date = new Date("2026-01-15");
      const next = getNextOccurrence(date, "annually", null, null);
      expect(next.toISOString().split("T")[0]).toBe("2027-01-15");
    });
  });

  describe("generateExpectedDates", () => {
    it("generates dates for next 14 days", () => {
      const template = {
        id: "template-1",
        frequency: "weekly" as const,
        dayOfMonth: null,
        dayOfWeek: null,
        startDate: "2026-01-01",
        endDate: null,
        amount: "100",
        isActive: true,
      };

      const dates = generateExpectedDates(template, new Set(), 14);
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.length).toBeLessThanOrEqual(3); // Max ~2-3 weekly occurrences in 14 days
    });

    it("skips existing dates", () => {
      const template = {
        id: "template-1",
        frequency: "weekly" as const,
        dayOfMonth: null,
        dayOfWeek: null,
        startDate: "2026-01-01",
        endDate: null,
        amount: "100",
        isActive: true,
      };

      const allDates = generateExpectedDates(template, new Set(), 14);
      const existingDates = new Set([allDates[0]]);
      const newDates = generateExpectedDates(template, existingDates, 14);

      expect(newDates).not.toContain(allDates[0]);
    });

    it("respects endDate", () => {
      const template = {
        id: "template-1",
        frequency: "weekly" as const,
        dayOfMonth: null,
        dayOfWeek: null,
        startDate: "2026-01-01",
        endDate: "2026-01-10",
        amount: "100",
        isActive: true,
      };

      const dates = generateExpectedDates(template, new Set(), 30);
      dates.forEach((date) => {
        expect(new Date(date) <= new Date("2026-01-10")).toBe(true);
      });
    });

    it("returns empty for inactive templates", () => {
      const template = {
        id: "template-1",
        frequency: "weekly" as const,
        dayOfMonth: null,
        dayOfWeek: null,
        startDate: "2026-01-01",
        endDate: null,
        amount: "100",
        isActive: false,
      };

      const dates = generateExpectedDates(template, new Set(), 14);
      expect(dates).toHaveLength(0);
    });
  });

  describe("calculateMatchConfidence", () => {
    it("returns high for exact amount and close date", () => {
      const confidence = calculateMatchConfidence(
        1000, 1000, "2026-01-15", "2026-01-15", 5, 3
      );
      expect(confidence).toBe("high");
    });

    it("returns high for amount within 1% and date within 2 days", () => {
      const confidence = calculateMatchConfidence(
        1000, 1008, "2026-01-15", "2026-01-16", 5, 3
      );
      expect(confidence).toBe("high");
    });

    it("returns medium for amount within tolerance but not high", () => {
      const confidence = calculateMatchConfidence(
        1000, 1040, "2026-01-15", "2026-01-15", 5, 3
      );
      expect(confidence).toBe("medium");
    });

    it("returns null for amount outside tolerance", () => {
      const confidence = calculateMatchConfidence(
        1000, 1100, "2026-01-15", "2026-01-15", 5, 3
      );
      expect(confidence).toBeNull();
    });

    it("returns null for date outside tolerance", () => {
      const confidence = calculateMatchConfidence(
        1000, 1000, "2026-01-15", "2026-01-20", 5, 3
      );
      expect(confidence).toBeNull();
    });
  });

  describe("findBestMatch", () => {
    it("returns best match from candidates", () => {
      const candidates = [
        { id: "tx-1", amount: "1000", date: "2026-01-15" },
        { id: "tx-2", amount: "1005", date: "2026-01-16" },
        { id: "tx-3", amount: "1050", date: "2026-01-15" },
      ];

      const match = findBestMatch(1000, "2026-01-15", candidates, 5, 3);
      expect(match?.transactionId).toBe("tx-1");
      expect(match?.confidence).toBe("high");
    });

    it("prefers high confidence over medium", () => {
      const candidates = [
        { id: "tx-1", amount: "1040", date: "2026-01-15" }, // medium
        { id: "tx-2", amount: "1005", date: "2026-01-16" }, // high
      ];

      const match = findBestMatch(1000, "2026-01-15", candidates, 5, 3);
      expect(match?.transactionId).toBe("tx-2");
    });

    it("returns null when no candidates match", () => {
      const candidates = [
        { id: "tx-1", amount: "2000", date: "2026-01-15" },
      ];

      const match = findBestMatch(1000, "2026-01-15", candidates, 5, 3);
      expect(match).toBeNull();
    });
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/server/services/__tests__/recurring.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/services/recurring.ts src/server/services/__tests__/recurring.test.ts
git commit -m "feat(recurring): add generation and matching service"
```

---

### Task 4: Create recurring router with CRUD endpoints

**Files:**
- Create: `src/server/routers/recurring.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/recurring.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  recurringTransactions,
  expectedTransactions,
  properties,
  transactions,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { generateExpectedDates, findBestMatch } from "../services/recurring";

const frequencyEnum = z.enum([
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "annually",
]);

export const recurringRouter = router({
  /**
   * Create a new recurring transaction template
   */
  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        description: z.string().min(1),
        amount: z.string().regex(/^\d+\.?\d*$/),
        category: z.string(),
        transactionType: z.enum(["income", "expense"]),
        frequency: frequencyEnum,
        dayOfMonth: z.number().min(1).max(31).optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        startDate: z.string(),
        endDate: z.string().optional(),
        linkedBankAccountId: z.string().uuid().optional(),
        amountTolerance: z.string().default("5.00"),
        dateTolerance: z.number().default(3),
        alertDelayDays: z.number().default(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Create recurring template
      const [recurring] = await ctx.db
        .insert(recurringTransactions)
        .values({
          userId: ctx.user.id,
          propertyId: input.propertyId,
          description: input.description,
          amount: input.amount,
          category: input.category as any,
          transactionType: input.transactionType,
          frequency: input.frequency,
          dayOfMonth: input.dayOfMonth,
          dayOfWeek: input.dayOfWeek,
          startDate: input.startDate,
          endDate: input.endDate,
          linkedBankAccountId: input.linkedBankAccountId,
          amountTolerance: input.amountTolerance,
          dateTolerance: input.dateTolerance,
          alertDelayDays: input.alertDelayDays,
        })
        .returning();

      // Generate initial expected transactions
      const dates = generateExpectedDates(
        {
          id: recurring.id,
          frequency: recurring.frequency,
          dayOfMonth: recurring.dayOfMonth,
          dayOfWeek: recurring.dayOfWeek,
          startDate: recurring.startDate,
          endDate: recurring.endDate,
          amount: recurring.amount,
          isActive: recurring.isActive,
        },
        new Set(),
        14
      );

      if (dates.length > 0) {
        await ctx.db.insert(expectedTransactions).values(
          dates.map((date) => ({
            recurringTransactionId: recurring.id,
            userId: ctx.user.id,
            propertyId: input.propertyId,
            expectedDate: date,
            expectedAmount: input.amount,
          }))
        );
      }

      return recurring;
    }),

  /**
   * List recurring templates for user
   */
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let conditions = [eq(recurringTransactions.userId, ctx.user.id)];

      if (input.propertyId) {
        conditions.push(eq(recurringTransactions.propertyId, input.propertyId));
      }
      if (input.isActive !== undefined) {
        conditions.push(eq(recurringTransactions.isActive, input.isActive));
      }

      return ctx.db.query.recurringTransactions.findMany({
        where: and(...conditions),
        with: {
          property: true,
          linkedBankAccount: true,
        },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      });
    }),

  /**
   * Get a single recurring template
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const recurring = await ctx.db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.userId, ctx.user.id)
        ),
        with: {
          property: true,
          linkedBankAccount: true,
          expectedTransactions: {
            orderBy: (e, { desc }) => [desc(e.expectedDate)],
            limit: 10,
          },
        },
      });

      if (!recurring) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring transaction not found",
        });
      }

      return recurring;
    }),

  /**
   * Update a recurring template
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        description: z.string().min(1).optional(),
        amount: z.string().regex(/^\d+\.?\d*$/).optional(),
        category: z.string().optional(),
        transactionType: z.enum(["income", "expense"]).optional(),
        frequency: frequencyEnum.optional(),
        dayOfMonth: z.number().min(1).max(31).nullable().optional(),
        dayOfWeek: z.number().min(0).max(6).nullable().optional(),
        endDate: z.string().nullable().optional(),
        linkedBankAccountId: z.string().uuid().nullable().optional(),
        amountTolerance: z.string().optional(),
        dateTolerance: z.number().optional(),
        alertDelayDays: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const existing = await ctx.db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring transaction not found",
        });
      }

      const [updated] = await ctx.db
        .update(recurringTransactions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(recurringTransactions.id, id))
        .returning();

      return updated;
    }),

  /**
   * Delete a recurring template
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.recurringTransactions.findFirst({
        where: and(
          eq(recurringTransactions.id, input.id),
          eq(recurringTransactions.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring transaction not found",
        });
      }

      await ctx.db
        .delete(recurringTransactions)
        .where(eq(recurringTransactions.id, input.id));

      return { success: true };
    }),

  /**
   * Get expected transactions for reconciliation
   */
  getExpectedTransactions: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "matched", "missed", "skipped"]).optional(),
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let conditions = [eq(expectedTransactions.userId, ctx.user.id)];

      if (input.status) {
        conditions.push(eq(expectedTransactions.status, input.status));
      }
      if (input.propertyId) {
        conditions.push(eq(expectedTransactions.propertyId, input.propertyId));
      }

      return ctx.db.query.expectedTransactions.findMany({
        where: and(...conditions),
        with: {
          recurringTransaction: true,
          property: true,
          matchedTransaction: true,
        },
        orderBy: (e, { desc }) => [desc(e.expectedDate)],
      });
    }),

  /**
   * Skip an expected transaction
   */
  skip: protectedProcedure
    .input(z.object({ expectedId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const expected = await ctx.db.query.expectedTransactions.findFirst({
        where: and(
          eq(expectedTransactions.id, input.expectedId),
          eq(expectedTransactions.userId, ctx.user.id)
        ),
      });

      if (!expected) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Expected transaction not found",
        });
      }

      const [updated] = await ctx.db
        .update(expectedTransactions)
        .set({ status: "skipped" })
        .where(eq(expectedTransactions.id, input.expectedId))
        .returning();

      return updated;
    }),

  /**
   * Manually match an expected transaction to a bank transaction
   */
  matchManually: protectedProcedure
    .input(
      z.object({
        expectedId: z.string().uuid(),
        transactionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership of expected transaction
      const expected = await ctx.db.query.expectedTransactions.findFirst({
        where: and(
          eq(expectedTransactions.id, input.expectedId),
          eq(expectedTransactions.userId, ctx.user.id)
        ),
        with: { recurringTransaction: true },
      });

      if (!expected) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Expected transaction not found",
        });
      }

      // Verify ownership of bank transaction
      const transaction = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.transactionId),
          eq(transactions.userId, ctx.user.id)
        ),
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      // Update expected transaction
      const [updatedExpected] = await ctx.db
        .update(expectedTransactions)
        .set({
          status: "matched",
          matchedTransactionId: input.transactionId,
          matchConfidence: "medium",
        })
        .where(eq(expectedTransactions.id, input.expectedId))
        .returning();

      // Apply category from template to transaction if uncategorized
      if (transaction.category === "uncategorized" && expected.recurringTransaction) {
        await ctx.db
          .update(transactions)
          .set({
            category: expected.recurringTransaction.category,
            transactionType: expected.recurringTransaction.transactionType,
            propertyId: expected.propertyId,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, input.transactionId));
      }

      return updatedExpected;
    }),
});
```

**Step 2: Add to _app.ts**

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
});

export type AppRouter = typeof appRouter;
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/recurring.ts src/server/routers/_app.ts
git commit -m "feat(recurring): add CRUD router endpoints"
```

---

### Task 5: Add router tests

**Files:**
- Create: `src/server/routers/__tests__/recurring.test.ts`

**Step 1: Create test file**

Create `src/server/routers/__tests__/recurring.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("recurring router", () => {
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
  };

  const mockRecurring = {
    id: "660e8400-e29b-41d4-a716-446655440001",
    userId: "user-1",
    propertyId: "550e8400-e29b-41d4-a716-446655440000",
    description: "Monthly Rent",
    amount: "2400.00",
    category: "rental_income",
    transactionType: "income",
    frequency: "monthly",
    dayOfMonth: 1,
    dayOfWeek: null,
    startDate: "2026-01-01",
    endDate: null,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates recurring template and generates expected transactions", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRecurring]),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(mockProperty) },
        },
        insert: insertMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.create({
        propertyId: mockProperty.id,
        description: "Monthly Rent",
        amount: "2400.00",
        category: "rental_income",
        transactionType: "income",
        frequency: "monthly",
        dayOfMonth: 1,
        startDate: "2026-01-01",
      });

      expect(result.id).toBe(mockRecurring.id);
      expect(insertMock).toHaveBeenCalled();
    });

    it("rejects non-existent property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.recurring.create({
          propertyId: mockProperty.id,
          description: "Monthly Rent",
          amount: "2400.00",
          category: "rental_income",
          transactionType: "income",
          frequency: "monthly",
          startDate: "2026-01-01",
        })
      ).rejects.toThrow("Property not found");
    });
  });

  describe("skip", () => {
    it("marks expected transaction as skipped", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const mockExpected = {
        id: "expected-1",
        userId: "user-1",
        status: "pending",
      };

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockExpected, status: "skipped" }]),
          }),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          expectedTransactions: { findFirst: vi.fn().mockResolvedValue(mockExpected) },
        },
        update: updateMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.skip({
        expectedId: "550e8400-e29b-41d4-a716-446655440002",
      });

      expect(result.status).toBe("skipped");
    });
  });

  describe("matchManually", () => {
    it("links expected to actual transaction", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const mockExpected = {
        id: "expected-1",
        userId: "user-1",
        propertyId: mockProperty.id,
        status: "pending",
        recurringTransaction: mockRecurring,
      };

      const mockTransaction = {
        id: "tx-1",
        userId: "user-1",
        category: "uncategorized",
      };

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockExpected, status: "matched" }]),
          }),
        }),
      });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          expectedTransactions: { findFirst: vi.fn().mockResolvedValue(mockExpected) },
          transactions: { findFirst: vi.fn().mockResolvedValue(mockTransaction) },
        },
        update: updateMock,
      };

      const caller = createTestCaller(ctx);
      const result = await caller.recurring.matchManually({
        expectedId: "550e8400-e29b-41d4-a716-446655440002",
        transactionId: "550e8400-e29b-41d4-a716-446655440003",
      });

      expect(result.status).toBe("matched");
      expect(updateMock).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/server/routers/__tests__/recurring.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/recurring.test.ts
git commit -m "test(recurring): add router unit tests"
```

---

### Task 6: Create cron endpoint for generation

**Files:**
- Create: `src/app/api/cron/generate-expected/route.ts`

**Step 1: Create the cron route**

Create `src/app/api/cron/generate-expected/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  recurringTransactions,
  expectedTransactions,
  transactions,
} from "@/server/db/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { generateExpectedDates, findBestMatch } from "@/server/services/recurring";
import { addDays, subDays } from "date-fns";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active recurring templates
    const templates = await db.query.recurringTransactions.findMany({
      where: eq(recurringTransactions.isActive, true),
    });

    let generatedCount = 0;
    let matchedCount = 0;
    let missedCount = 0;

    for (const template of templates) {
      // Get existing expected dates for this template
      const existing = await db.query.expectedTransactions.findMany({
        where: eq(expectedTransactions.recurringTransactionId, template.id),
      });
      const existingDates = new Set(existing.map((e) => e.expectedDate));

      // Generate new expected transactions
      const newDates = generateExpectedDates(
        {
          id: template.id,
          frequency: template.frequency,
          dayOfMonth: template.dayOfMonth,
          dayOfWeek: template.dayOfWeek,
          startDate: template.startDate,
          endDate: template.endDate,
          amount: template.amount,
          isActive: template.isActive,
        },
        existingDates,
        14
      );

      if (newDates.length > 0) {
        await db.insert(expectedTransactions).values(
          newDates.map((date) => ({
            recurringTransactionId: template.id,
            userId: template.userId,
            propertyId: template.propertyId,
            expectedDate: date,
            expectedAmount: template.amount,
          }))
        );
        generatedCount += newDates.length;
      }

      // Try to match pending expected transactions
      const pending = await db.query.expectedTransactions.findMany({
        where: and(
          eq(expectedTransactions.recurringTransactionId, template.id),
          eq(expectedTransactions.status, "pending")
        ),
      });

      for (const expected of pending) {
        // Find candidate transactions
        const startWindow = subDays(new Date(expected.expectedDate), Number(template.dateTolerance));
        const endWindow = addDays(new Date(expected.expectedDate), Number(template.dateTolerance));

        const candidates = await db.query.transactions.findMany({
          where: and(
            eq(transactions.userId, template.userId),
            eq(transactions.propertyId, template.propertyId),
            gte(transactions.date, startWindow.toISOString().split("T")[0]),
            lte(transactions.date, endWindow.toISOString().split("T")[0])
          ),
        });

        // Filter by bank account if specified
        const filteredCandidates = template.linkedBankAccountId
          ? candidates.filter((c) => c.bankAccountId === template.linkedBankAccountId)
          : candidates;

        const match = findBestMatch(
          Number(expected.expectedAmount),
          expected.expectedDate,
          filteredCandidates.map((c) => ({ id: c.id, amount: c.amount, date: c.date })),
          Number(template.amountTolerance),
          template.dateTolerance
        );

        if (match && match.confidence === "high") {
          // Auto-match high confidence
          await db
            .update(expectedTransactions)
            .set({
              status: "matched",
              matchedTransactionId: match.transactionId,
              matchConfidence: "high",
            })
            .where(eq(expectedTransactions.id, expected.id));

          // Apply category to transaction
          await db
            .update(transactions)
            .set({
              category: template.category,
              transactionType: template.transactionType,
              propertyId: template.propertyId,
              updatedAt: new Date(),
            })
            .where(eq(transactions.id, match.transactionId));

          matchedCount++;
        }

        // Check for missed transactions
        const today = new Date();
        const expectedDatePlusDelay = addDays(
          new Date(expected.expectedDate),
          template.alertDelayDays
        );

        if (today > expectedDatePlusDelay && expected.status === "pending") {
          await db
            .update(expectedTransactions)
            .set({ status: "missed" })
            .where(eq(expectedTransactions.id, expected.id));

          missedCount++;
          // TODO: Queue email alert
        }
      }
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      matched: matchedCount,
      missed: missedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Add to vercel.json cron config**

If vercel.json doesn't exist or doesn't have crons, add the configuration. Check first:

Run: `cat vercel.json 2>/dev/null || echo "File not found"`

If needed, create or update vercel.json with:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-banks",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/generate-expected",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/cron/generate-expected/route.ts vercel.json
git commit -m "feat(recurring): add cron endpoint for generation and matching"
```

---

### Task 7: Create MakeRecurringDialog component

**Files:**
- Create: `src/components/recurring/MakeRecurringDialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/recurring/MakeRecurringDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Repeat } from "lucide-react";

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
  frequency: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "annually"]),
  dayOfMonth: z.number().min(1).max(31).optional(),
  startDate: z.string(),
  alertDelayDays: z.number().min(1).max(30),
});

type FormValues = z.infer<typeof formSchema>;

interface MakeRecurringDialogProps {
  transaction: {
    id: string;
    description: string;
    amount: string;
    category: string;
    transactionType: string;
    propertyId: string | null;
    date: string;
  };
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function MakeRecurringDialog({
  transaction,
  onSuccess,
  trigger,
}: MakeRecurringDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: transaction.description,
      amount: String(Math.abs(Number(transaction.amount))),
      frequency: "monthly",
      dayOfMonth: new Date(transaction.date).getDate(),
      startDate: transaction.date,
      alertDelayDays: 3,
    },
  });

  const createRecurring = trpc.recurring.create.useMutation({
    onSuccess: () => {
      toast.success("Recurring transaction created");
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!transaction.propertyId) {
      toast.error("Transaction must be assigned to a property first");
      return;
    }

    createRecurring.mutate({
      propertyId: transaction.propertyId,
      description: values.description,
      amount: values.amount,
      category: transaction.category,
      transactionType: transaction.transactionType as "income" | "expense",
      frequency: values.frequency,
      dayOfMonth: values.frequency !== "weekly" && values.frequency !== "fortnightly"
        ? values.dayOfMonth
        : undefined,
      startDate: values.startDate,
      alertDelayDays: values.alertDelayDays,
    });
  };

  const frequency = form.watch("frequency");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Repeat className="h-4 w-4 mr-2" />
            Make Recurring
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Recurring Transaction</DialogTitle>
          <DialogDescription>
            Set up automatic tracking for this recurring transaction.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" inputMode="decimal" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {frequency !== "weekly" && frequency !== "fortnightly" && (
              <FormField
                control={form.control}
                name="dayOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Month</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="alertDelayDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert After (days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRecurring.isPending}>
                {createRecurring.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create index export**

Create `src/components/recurring/index.ts`:

```typescript
export { MakeRecurringDialog } from "./MakeRecurringDialog";
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/recurring/
git commit -m "feat(recurring): add MakeRecurringDialog component"
```

---

### Task 8: Add "Make Recurring" to transaction table

**Files:**
- Modify: `src/components/transactions/TransactionTable.tsx`

**Step 1: Import the dialog**

Add to imports in `TransactionTable.tsx`:

```typescript
import { MakeRecurringDialog } from "@/components/recurring";
```

**Step 2: Add to dropdown menu**

Find the DropdownMenuContent in the table row and add after the existing menu items:

```typescript
<DropdownMenuItem asChild>
  <MakeRecurringDialog
    transaction={{
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      transactionType: transaction.transactionType,
      propertyId: transaction.propertyId,
      date: transaction.date,
    }}
    trigger={
      <button className="w-full text-left flex items-center px-2 py-1.5 text-sm">
        <Repeat className="h-4 w-4 mr-2" />
        Make Recurring
      </button>
    }
  />
</DropdownMenuItem>
```

Also add `Repeat` to the lucide-react imports.

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/transactions/TransactionTable.tsx
git commit -m "feat(recurring): add Make Recurring option to transaction menu"
```

---

### Task 9: Create ReconciliationView component

**Files:**
- Create: `src/components/recurring/ReconciliationView.tsx`

**Step 1: Create the component**

Create `src/components/recurring/ReconciliationView.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Check, X, AlertCircle, Clock, Link2 } from "lucide-react";
import { toast } from "sonner";

export function ReconciliationView() {
  const [activeTab, setActiveTab] = useState<string>("pending");

  const { data: expectedTransactions, refetch } = trpc.recurring.getExpectedTransactions.useQuery({
    status: activeTab as "pending" | "matched" | "missed" | "skipped" | undefined,
  });

  const skipMutation = trpc.recurring.skip.useMutation({
    onSuccess: () => {
      toast.success("Transaction skipped");
      refetch();
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "matched":
        return <Check className="h-4 w-4 text-green-500" />;
      case "missed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "skipped":
        return <X className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "matched":
        return "bg-green-100 text-green-800";
      case "missed":
        return "bg-red-100 text-red-800";
      case "skipped":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="matched">Matched</TabsTrigger>
          <TabsTrigger value="missed">Missed</TabsTrigger>
          <TabsTrigger value="skipped">Skipped</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {expectedTransactions?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No {activeTab} transactions
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {expectedTransactions?.map((expected) => (
                <Card key={expected.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(expected.status)}
                        <div>
                          <p className="font-medium">
                            {expected.recurringTransaction?.description}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{expected.property?.address}</span>
                            <span>&bull;</span>
                            <span>
                              Expected {format(new Date(expected.expectedDate), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(Number(expected.expectedAmount))}
                          </p>
                          <Badge className={getStatusColor(expected.status)}>
                            {expected.status}
                            {expected.matchConfidence && ` (${expected.matchConfidence})`}
                          </Badge>
                        </div>

                        {expected.status === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => skipMutation.mutate({ expectedId: expected.id })}
                            >
                              Skip
                            </Button>
                            <Button variant="outline" size="sm">
                              <Link2 className="h-4 w-4 mr-1" />
                              Match
                            </Button>
                          </div>
                        )}

                        {expected.status === "matched" && expected.matchedTransaction && (
                          <div className="text-sm text-muted-foreground">
                            Matched: {expected.matchedTransaction.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Export from index**

Update `src/components/recurring/index.ts`:

```typescript
export { MakeRecurringDialog } from "./MakeRecurringDialog";
export { ReconciliationView } from "./ReconciliationView";
```

**Step 3: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/recurring/
git commit -m "feat(recurring): add ReconciliationView component"
```

---

### Task 10: Add reconciliation view toggle to transactions page

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`

**Step 1: Import ReconciliationView**

Add to imports:

```typescript
import { ReconciliationView } from "@/components/recurring";
```

**Step 2: Add view toggle state**

Add after page state:

```typescript
const [view, setView] = useState<"transactions" | "reconciliation">("transactions");
```

**Step 3: Add toggle buttons**

Add after the filters, before the transaction table:

```typescript
<div className="flex gap-2">
  <Button
    variant={view === "transactions" ? "default" : "outline"}
    size="sm"
    onClick={() => setView("transactions")}
  >
    All Transactions
  </Button>
  <Button
    variant={view === "reconciliation" ? "default" : "outline"}
    size="sm"
    onClick={() => setView("reconciliation")}
  >
    Reconciliation
  </Button>
</div>
```

**Step 4: Conditionally render views**

Wrap the transaction table in a condition:

```typescript
{view === "transactions" ? (
  // existing transaction table code
) : (
  <ReconciliationView />
)}
```

**Step 5: Run TypeScript to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/app/(dashboard)/transactions/page.tsx
git commit -m "feat(recurring): add reconciliation view toggle to transactions page"
```

---

### Task 11: Run all tests and verify build

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix any lint/type issues"
```

---

### Task 12: Final commit and push

**Step 1: Push all commits**

```bash
git push origin feature/infrastructure
```

**Step 2: Summary**

The recurring transactions feature is complete with:
- Database schema (recurring templates + expected transactions)
- Service layer (generation + matching logic)
- tRPC router (CRUD + reconciliation endpoints)
- Cron job (daily generation + auto-matching)
- UI components (MakeRecurringDialog, ReconciliationView)
- Integration with transactions page
