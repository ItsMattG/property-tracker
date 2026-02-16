# Personal Budget Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add personal budget tracking with separate transaction pipeline, dashboard widget, and dedicated budget page.

**Architecture:** Standalone budget domain with `personal_categories`, `personal_transactions`, and `budgets` tables. Bank accounts get a `defaultTransactionType` column to route Basiq transactions to the correct pipeline. Three new repositories, one new router namespace, one dashboard widget, one page route.

**Tech Stack:** Drizzle ORM (pgTable, pgEnum, relations), tRPC v11 (router/procedure), Vitest (unit/integration), React 19 + Recharts (UI), Playwright (E2E)

**Design doc:** `docs/plans/2026-02-17-personal-budget-tracker-design.md`

**Beads task:** property-tracker-o0l

---

## Tech Notes (context7)

- **Drizzle pgEnum:** `export const myEnum = pgEnum("name", ["val1", "val2"])` — use in column as `myEnum("column_name")`
- **Drizzle pgTable:** `pgTable("name", { columns }, (table) => [indexes])` — uuid PK with `.primaryKey().defaultRandom()`
- **Drizzle relations:** `relations(table, ({ one, many }) => ({ ... }))` — separate from table definition
- **Drizzle types:** `typeof table.$inferSelect` for select type, `typeof table.$inferInsert` for insert type
- **tRPC v11:** Use `trpc.useUtils()` not `trpc.useContext()`. Use `utils.x.y.invalidate()` for cache.
- **Zod v4:** `z.string().min(1, "Required")` not `.nonempty()`. `z.enum([...], { error: "msg" })`.

---

## Task 1: Schema — Enums and Tables

**Files:**
- Modify: `src/server/db/schema/enums.ts` (add 2 enums)
- Create: `src/server/db/schema/budget.ts` (3 tables + relations)
- Modify: `src/server/db/schema/index.ts` (export new schema)
- Modify: `src/server/db/schema/banking.ts` (add column to bank_accounts)

**Step 1: Add enums to `src/server/db/schema/enums.ts`**

```typescript
export const budgetGroupEnum = pgEnum("budget_group", [
  "needs",
  "wants",
  "savings",
]);

export const defaultTransactionTypeEnum = pgEnum("default_transaction_type", [
  "property",
  "personal",
  "ask",
]);
```

**Step 2: Create `src/server/db/schema/budget.ts`**

```typescript
import { pgTable, uuid, text, numeric, integer, boolean, timestamp, date, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { bankAccounts } from "./banking";
import { budgetGroupEnum } from "./enums";

// --- Personal Categories ---

export const personalCategories = pgTable("personal_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  group: budgetGroupEnum("group"),
  icon: text("icon").notNull().default("circle"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("personal_categories_user_id_idx").on(table.userId),
]);

export const personalCategoriesRelations = relations(personalCategories, ({ one, many }) => ({
  user: one(users, { fields: [personalCategories.userId], references: [users.id] }),
  transactions: many(personalTransactions),
  budgets: many(budgets),
}));

// --- Personal Transactions ---

export const personalTransactions = pgTable("personal_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date", { mode: "date" }).notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  personalCategoryId: uuid("personal_category_id").references(() => personalCategories.id, { onDelete: "set null" }),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
  basiqTransactionId: text("basiq_transaction_id"),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  suggestedCategoryId: uuid("suggested_category_id").references(() => personalCategories.id, { onDelete: "set null" }),
  suggestionConfidence: integer("suggestion_confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("personal_transactions_user_id_idx").on(table.userId),
  index("personal_transactions_date_idx").on(table.date),
  index("personal_transactions_category_id_idx").on(table.personalCategoryId),
  index("personal_transactions_basiq_id_idx").on(table.basiqTransactionId),
]);

export const personalTransactionsRelations = relations(personalTransactions, ({ one }) => ({
  user: one(users, { fields: [personalTransactions.userId], references: [users.id] }),
  category: one(personalCategories, { fields: [personalTransactions.personalCategoryId], references: [personalCategories.id] }),
  bankAccount: one(bankAccounts, { fields: [personalTransactions.bankAccountId], references: [bankAccounts.id] }),
}));

// --- Budgets ---

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  personalCategoryId: uuid("personal_category_id").references(() => personalCategories.id, { onDelete: "cascade" }),
  monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from", { mode: "date" }).notNull(),
  effectiveTo: date("effective_to", { mode: "date" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("budgets_user_id_idx").on(table.userId),
  index("budgets_category_id_idx").on(table.personalCategoryId),
]);

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(personalCategories, { fields: [budgets.personalCategoryId], references: [personalCategories.id] }),
}));

// --- Type Exports ---

export type PersonalCategory = typeof personalCategories.$inferSelect;
export type NewPersonalCategory = typeof personalCategories.$inferInsert;
export type PersonalTransaction = typeof personalTransactions.$inferSelect;
export type NewPersonalTransaction = typeof personalTransactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
```

**Step 3: Add `defaultTransactionType` column to bank_accounts in `src/server/db/schema/banking.ts`**

Find the `bankAccounts` table definition. Add after the `defaultPropertyId` column:

```typescript
defaultTransactionType: defaultTransactionTypeEnum("default_transaction_type"),
```

Import `defaultTransactionTypeEnum` from `./enums`.

**Step 4: Export from `src/server/db/schema/index.ts`**

Add:
```typescript
export * from "./budget";
```

**Step 5: Push schema to database**

Run: `npx drizzle-kit push`
Expected: Tables `personal_categories`, `personal_transactions`, `budgets` created. Column `default_transaction_type` added to `bank_accounts`.

**Step 6: Commit**

```
git add src/server/db/schema/
git commit -m "feat: add budget schema with personal categories, transactions, and budgets"
```

---

## Task 2: Personal Category Repository + Tests

**Files:**
- Create: `src/server/repositories/interfaces/personal-category.repository.interface.ts`
- Create: `src/server/repositories/personal-category.repository.ts`
- Create: `src/server/repositories/__tests__/personal-category.repository.test.ts`
- Modify: `src/server/repositories/interfaces/index.ts` (export interface)

**Step 1: Create interface at `src/server/repositories/interfaces/personal-category.repository.interface.ts`**

```typescript
import type { PersonalCategory, NewPersonalCategory } from "../../db/schema";

export interface IPersonalCategoryRepository {
  findByUser(userId: string): Promise<PersonalCategory[]>;
  findById(id: string, userId: string): Promise<PersonalCategory | null>;
  create(data: NewPersonalCategory): Promise<PersonalCategory>;
  update(id: string, userId: string, data: Partial<PersonalCategory>): Promise<PersonalCategory | null>;
  delete(id: string, userId: string): Promise<void>;
  seedDefaults(userId: string): Promise<PersonalCategory[]>;
}
```

**Step 2: Export from `src/server/repositories/interfaces/index.ts`**

Add:
```typescript
export type { IPersonalCategoryRepository } from "./personal-category.repository.interface";
```

**Step 3: Write failing tests at `src/server/repositories/__tests__/personal-category.repository.test.ts`**

Write tests for: `findByUser`, `findById`, `create`, `update`, `delete`, `seedDefaults`. Follow existing pattern from `property.repository.test.ts` — use `describe.skipIf(!hasDatabase)`, test user setup/teardown.

Key test cases:
- `seedDefaults` creates 15 categories with correct groups (6 needs, 6 wants, 3 savings)
- `findByUser` only returns categories for that user
- `create` with custom category works
- `update` changes name/group
- `delete` removes category
- `findById` returns null for non-existent

Run: `npx vitest run src/server/repositories/__tests__/personal-category.repository.test.ts`
Expected: FAIL — repository doesn't exist yet

**Step 4: Implement `src/server/repositories/personal-category.repository.ts`**

```typescript
import { eq, and } from "drizzle-orm";
import { personalCategories } from "../db/schema";
import type { PersonalCategory, NewPersonalCategory } from "../db/schema";
import { BaseRepository } from "./base";
import type { IPersonalCategoryRepository } from "./interfaces";

const DEFAULT_CATEGORIES = [
  { name: "Rent/Mortgage", group: "needs" as const, icon: "home", sortOrder: 0 },
  { name: "Groceries", group: "needs" as const, icon: "shopping-cart", sortOrder: 1 },
  { name: "Utilities", group: "needs" as const, icon: "zap", sortOrder: 2 },
  { name: "Transport", group: "needs" as const, icon: "car", sortOrder: 3 },
  { name: "Insurance", group: "needs" as const, icon: "shield", sortOrder: 4 },
  { name: "Health", group: "needs" as const, icon: "heart-pulse", sortOrder: 5 },
  { name: "Dining Out", group: "wants" as const, icon: "utensils", sortOrder: 6 },
  { name: "Entertainment", group: "wants" as const, icon: "tv", sortOrder: 7 },
  { name: "Subscriptions", group: "wants" as const, icon: "repeat", sortOrder: 8 },
  { name: "Clothing", group: "wants" as const, icon: "shirt", sortOrder: 9 },
  { name: "Personal Care", group: "wants" as const, icon: "sparkles", sortOrder: 10 },
  { name: "Gifts", group: "wants" as const, icon: "gift", sortOrder: 11 },
  { name: "Savings", group: "savings" as const, icon: "piggy-bank", sortOrder: 12 },
  { name: "Debt Repayment", group: "savings" as const, icon: "trending-down", sortOrder: 13 },
  { name: "Education", group: "savings" as const, icon: "graduation-cap", sortOrder: 14 },
] as const;

export class PersonalCategoryRepository extends BaseRepository implements IPersonalCategoryRepository {
  async findByUser(userId: string): Promise<PersonalCategory[]> {
    return this.db
      .select()
      .from(personalCategories)
      .where(eq(personalCategories.userId, userId))
      .orderBy(personalCategories.sortOrder);
  }

  async findById(id: string, userId: string): Promise<PersonalCategory | null> {
    const [category] = await this.db
      .select()
      .from(personalCategories)
      .where(and(eq(personalCategories.id, id), eq(personalCategories.userId, userId)));
    return category ?? null;
  }

  async create(data: NewPersonalCategory): Promise<PersonalCategory> {
    const [category] = await this.db
      .insert(personalCategories)
      .values(data)
      .returning();
    return category;
  }

  async update(id: string, userId: string, data: Partial<PersonalCategory>): Promise<PersonalCategory | null> {
    const [updated] = await this.db
      .update(personalCategories)
      .set(data)
      .where(and(eq(personalCategories.id, id), eq(personalCategories.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(personalCategories)
      .where(and(eq(personalCategories.id, id), eq(personalCategories.userId, userId)));
  }

  async seedDefaults(userId: string): Promise<PersonalCategory[]> {
    const values = DEFAULT_CATEGORIES.map((cat) => ({
      userId,
      name: cat.name,
      group: cat.group,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
    }));
    return this.db.insert(personalCategories).values(values).returning();
  }
}
```

**Step 5: Run tests**

Run: `npx vitest run src/server/repositories/__tests__/personal-category.repository.test.ts`
Expected: PASS

**Step 6: Commit**

```
git add src/server/repositories/
git commit -m "feat: add personal category repository with seed defaults"
```

---

## Task 3: Budget Repository + Tests

**Files:**
- Create: `src/server/repositories/interfaces/budget.repository.interface.ts`
- Create: `src/server/repositories/budget.repository.ts`
- Create: `src/server/repositories/__tests__/budget.repository.test.ts`
- Modify: `src/server/repositories/interfaces/index.ts` (export interface)

**Step 1: Create interface at `src/server/repositories/interfaces/budget.repository.interface.ts`**

```typescript
import type { Budget, NewBudget } from "../../db/schema";

export interface BudgetWithSpend extends Budget {
  spent: number;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryGroup: string | null;
}

export interface IBudgetRepository {
  findByUser(userId: string, month: Date): Promise<BudgetWithSpend[]>;
  findById(id: string, userId: string): Promise<Budget | null>;
  findOverallBudget(userId: string, month: Date): Promise<Budget | null>;
  create(data: NewBudget): Promise<Budget>;
  update(id: string, userId: string, data: Partial<Budget>): Promise<Budget | null>;
  delete(id: string, userId: string): Promise<void>;
  getMonthlySpendByCategory(userId: string, month: Date): Promise<{ categoryId: string | null; total: number }[]>;
  getAverageMonthlyExpenses(userId: string, months: number): Promise<number>;
}
```

**Step 2: Export from `src/server/repositories/interfaces/index.ts`**

Add:
```typescript
export type { IBudgetRepository, BudgetWithSpend } from "./budget.repository.interface";
```

**Step 3: Write failing tests**

Key test cases:
- `create` overall budget (null categoryId)
- `create` category budget
- `findByUser` returns budgets with spend amounts for a given month
- `findOverallBudget` returns the overall target
- `getMonthlySpendByCategory` aggregates personal transactions by category for a month
- `getAverageMonthlyExpenses` returns average over N months
- `update` changes amount
- `delete` removes budget
- Data isolation: only returns budgets for the requesting user

Run: `npx vitest run src/server/repositories/__tests__/budget.repository.test.ts`
Expected: FAIL

**Step 4: Implement `src/server/repositories/budget.repository.ts`**

Repository uses Drizzle `sql` for aggregation queries. `findByUser` joins with `personalCategories` and `personalTransactions` to compute `spent` per category for the given month. `getAverageMonthlyExpenses` sums all personal transaction amounts (negative = expense) over the last N months and divides by N.

Key implementation note for `getAverageMonthlyExpenses`:
```typescript
const result = await this.db
  .select({ total: sql<number>`COALESCE(SUM(ABS(${personalTransactions.amount})), 0)::numeric` })
  .from(personalTransactions)
  .where(and(
    eq(personalTransactions.userId, userId),
    gte(personalTransactions.date, startDate),
    lt(personalTransactions.amount, "0"), // only expenses
  ));
return Number(result[0]?.total ?? 0) / months;
```

**Step 5: Run tests**

Run: `npx vitest run src/server/repositories/__tests__/budget.repository.test.ts`
Expected: PASS

**Step 6: Commit**

```
git add src/server/repositories/
git commit -m "feat: add budget repository with spend tracking and monthly aggregation"
```

---

## Task 4: Personal Transaction Repository + Tests

**Files:**
- Create: `src/server/repositories/interfaces/personal-transaction.repository.interface.ts`
- Create: `src/server/repositories/personal-transaction.repository.ts`
- Create: `src/server/repositories/__tests__/personal-transaction.repository.test.ts`
- Modify: `src/server/repositories/interfaces/index.ts` (export interface)

**Step 1: Create interface**

```typescript
import type { PersonalTransaction, NewPersonalTransaction } from "../../db/schema";

export interface PersonalTransactionWithCategory extends PersonalTransaction {
  categoryName: string | null;
  categoryIcon: string | null;
}

export interface IPersonalTransactionRepository {
  findByUser(userId: string, opts: {
    categoryId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: PersonalTransactionWithCategory[]; total: number }>;
  findById(id: string, userId: string): Promise<PersonalTransaction | null>;
  create(data: NewPersonalTransaction): Promise<PersonalTransaction>;
  createMany(data: NewPersonalTransaction[]): Promise<PersonalTransaction[]>;
  update(id: string, userId: string, data: Partial<PersonalTransaction>): Promise<PersonalTransaction | null>;
  delete(id: string, userId: string): Promise<void>;
  findByBasiqId(basiqTransactionId: string): Promise<PersonalTransaction | null>;
  getMonthlySummary(userId: string, months: number): Promise<{ month: string; income: number; expenses: number }[]>;
}
```

**Step 2: Export from interfaces/index.ts**

**Step 3: Write failing tests — CRUD, filtering, monthly summary, basiq dedup**

**Step 4: Implement repository**

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```
git commit -m "feat: add personal transaction repository with filtering and monthly summary"
```

---

## Task 5: Register Repositories in UnitOfWork

**Files:**
- Modify: `src/server/repositories/unit-of-work.ts`

**Step 1: Add imports and lazy getters**

Add three new repositories:
```typescript
import type { IPersonalCategoryRepository } from "./interfaces";
import type { IPersonalTransactionRepository } from "./interfaces";
import type { IBudgetRepository } from "./interfaces";
import { PersonalCategoryRepository } from "./personal-category.repository";
import { PersonalTransactionRepository } from "./personal-transaction.repository";
import { BudgetRepository } from "./budget.repository";

// In the class:
private _personalCategories?: IPersonalCategoryRepository;
private _personalTransactions?: IPersonalTransactionRepository;
private _budgets?: IBudgetRepository;

get personalCategories(): IPersonalCategoryRepository {
  return (this._personalCategories ??= new PersonalCategoryRepository(this.db));
}

get personalTransactions(): IPersonalTransactionRepository {
  return (this._personalTransactions ??= new PersonalTransactionRepository(this.db));
}

get budgets(): IBudgetRepository {
  return (this._budgets ??= new BudgetRepository(this.db));
}
```

**Step 2: Run existing tests to verify nothing broken**

Run: `npx vitest run`
Expected: All 900+ tests pass

**Step 3: Commit**

```
git commit -m "feat: register budget repositories in UnitOfWork"
```

---

## Task 6: Budget Router + Tests

**Files:**
- Create: `src/server/routers/budget/budget.ts`
- Create: `src/server/routers/budget/index.ts`
- Create: `src/server/routers/budget/__tests__/budget.test.ts`
- Modify: `src/server/routers/_app.ts` (register router)

**Step 1: Write failing router tests at `src/server/routers/budget/__tests__/budget.test.ts`**

Test cases:
- **Auth:** `budget.list`, `budget.create` throw UNAUTHORIZED when not authenticated
- **CRUD:** `personalCategory.list` returns seeded categories, `personalCategory.create` adds custom
- **CRUD:** `budget.list` returns budgets with spend for a month
- **CRUD:** `budget.create` creates overall and category budgets
- **CRUD:** `budget.update` changes amount
- **CRUD:** `budget.delete` removes budget
- **CRUD:** `personalTransaction.list` with filtering
- **CRUD:** `personalTransaction.create` manual entry
- **CRUD:** `personalTransaction.delete` removes transaction
- **Isolation:** budget.list only returns requesting user's data
- **Setup:** `budget.setup` seeds categories + creates overall budget in one call
- **Summary:** `budget.monthlySummary` returns spending trend data
- **Surplus:** `budget.surplus` returns income minus expenses

Use `createMockUow()` pattern from test-utils.

Run: `npx vitest run src/server/routers/budget/__tests__/budget.test.ts`
Expected: FAIL

**Step 2: Implement router at `src/server/routers/budget/budget.ts`**

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";

export const budgetRouter = router({
  // --- Personal Categories ---
  categoryList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.personalCategories.findByUser(ctx.portfolio.ownerId);
  }),

  categoryCreate: writeProcedure
    .input(z.object({
      name: z.string().min(1, "Name is required"),
      group: z.enum(["needs", "wants", "savings"]).nullable(),
      icon: z.string().default("circle"),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.personalCategories.create({
        userId: ctx.portfolio.ownerId,
        ...input,
      });
    }),

  // --- Budgets ---
  list: protectedProcedure
    .input(z.object({ month: z.date() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.budgets.findByUser(ctx.portfolio.ownerId, input.month);
    }),

  create: writeProcedure
    .input(z.object({
      personalCategoryId: z.string().uuid().nullable(),
      monthlyAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
      effectiveFrom: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.budgets.create({
        userId: ctx.portfolio.ownerId,
        personalCategoryId: input.personalCategoryId,
        monthlyAmount: input.monthlyAmount,
        effectiveFrom: input.effectiveFrom,
      });
    }),

  update: writeProcedure
    .input(z.object({
      id: z.string().uuid(),
      monthlyAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const budget = await ctx.uow.budgets.update(input.id, ctx.portfolio.ownerId, {
        monthlyAmount: input.monthlyAmount,
      });
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" });
      return budget;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.budgets.delete(input.id, ctx.portfolio.ownerId);
    }),

  setup: writeProcedure
    .input(z.object({
      monthlyTarget: z.string().regex(/^\d+(\.\d{1,2})?$/),
      categoryBudgets: z.array(z.object({
        categoryName: z.string(),
        group: z.enum(["needs", "wants", "savings"]).nullable(),
        monthlyAmount: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.portfolio.ownerId;
      // Seed default categories
      const categories = await ctx.uow.personalCategories.seedDefaults(userId);
      // Create overall budget
      const now = new Date();
      const effectiveFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      await ctx.uow.budgets.create({
        userId,
        personalCategoryId: null,
        monthlyAmount: input.monthlyTarget,
        effectiveFrom,
      });
      // Optionally create per-category budgets
      if (input.categoryBudgets) {
        for (const cb of input.categoryBudgets) {
          const cat = categories.find((c) => c.name === cb.categoryName);
          if (cat) {
            await ctx.uow.budgets.create({
              userId,
              personalCategoryId: cat.id,
              monthlyAmount: cb.monthlyAmount,
              effectiveFrom,
            });
          }
        }
      }
      return { categories };
    }),

  surplus: protectedProcedure.query(async ({ ctx }) => {
    const avgExpenses = await ctx.uow.budgets.getAverageMonthlyExpenses(ctx.portfolio.ownerId, 3);
    const summary = await ctx.uow.personalTransactions.getMonthlySummary(ctx.portfolio.ownerId, 3);
    const avgIncome = summary.reduce((sum, m) => sum + m.income, 0) / Math.max(summary.length, 1);
    const monthlySurplus = avgIncome - avgExpenses;
    return {
      avgMonthlyIncome: avgIncome,
      avgMonthlyExpenses: avgExpenses,
      monthlySurplus,
      annualSavingsCapacity: monthlySurplus * 12,
    };
  }),

  // --- Personal Transactions ---
  transactionList: protectedProcedure
    .input(z.object({
      categoryId: z.string().uuid().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.personalTransactions.findByUser(ctx.portfolio.ownerId, input);
    }),

  transactionCreate: writeProcedure
    .input(z.object({
      date: z.date(),
      description: z.string().min(1),
      amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
      personalCategoryId: z.string().uuid().nullable(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.personalTransactions.create({
        userId: ctx.portfolio.ownerId,
        ...input,
      });
    }),

  transactionDelete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.personalTransactions.delete(input.id, ctx.portfolio.ownerId);
    }),

  monthlySummary: protectedProcedure
    .input(z.object({ months: z.number().min(1).max(24).default(6) }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.personalTransactions.getMonthlySummary(ctx.portfolio.ownerId, input.months);
    }),
});
```

**Step 3: Create barrel export at `src/server/routers/budget/index.ts`**

```typescript
export { budgetRouter } from "./budget";
```

**Step 4: Register in `src/server/routers/_app.ts`**

Add import:
```typescript
import { budgetRouter } from "./budget";
```

Add to `appRouter`:
```typescript
budget: budgetRouter,
```

**Step 5: Run tests**

Run: `npx vitest run src/server/routers/budget/__tests__/budget.test.ts`
Expected: PASS

**Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```
git commit -m "feat: add budget tRPC router with CRUD, setup, and surplus endpoints"
```

---

## Task 7: Dashboard Budget Widget

**Files:**
- Create: `src/components/dashboard/BudgetWidget.tsx`
- Modify: dashboard page to include widget (find where widgets are composed)

**Step 1: Create `src/components/dashboard/BudgetWidget.tsx`**

Component structure:
- `"use client"` directive
- `trpc.budget.list.useQuery({ month: currentMonth })` for budget data
- `trpc.budget.surplus.useQuery()` for remaining amount
- Card with CardHeader ("Budget — Month Year" + month nav arrows)
- Overall progress bar (green/amber/red based on %)
- Top 5 category rows with mini progress bars
- Remaining/over callout
- "View full budget →" link to `/budget`
- Empty state: "Set up your budget" CTA that links to `/budget`
- Loading state: skeleton pulse

Follow existing CashFlowWidget pattern for Card/Recharts structure. Use `cn()` for conditional classes. Use `formatCurrency()` from `@/lib/utils/format`.

**Step 2: Add widget to dashboard**

Find the dashboard client component that composes widgets. Add `<BudgetWidget />` after the existing widgets.

**Step 3: Verify visually**

Run: `npm run dev`
Navigate to dashboard. Widget should show "Set up your budget" CTA (no budgets exist yet).

**Step 4: Commit**

```
git commit -m "feat: add budget dashboard widget with progress bars"
```

---

## Task 8: Budget Page

**Files:**
- Create: `src/app/(dashboard)/budget/page.tsx` (server component wrapper)
- Create: `src/components/budget/BudgetClient.tsx` (client component)
- Create: `src/components/budget/BudgetOverview.tsx` (left panel)
- Create: `src/components/budget/SpendingActivity.tsx` (right panel)
- Create: `src/components/budget/BudgetSetupSheet.tsx` (first-time setup)
- Create: `src/components/budget/CategoryBudgetRow.tsx` (list item)

**Step 1: Create page at `src/app/(dashboard)/budget/page.tsx`**

```typescript
import { BudgetClient } from "@/components/budget/BudgetClient";

export default function BudgetPage() {
  return <BudgetClient />;
}
```

**Step 2: Create `BudgetClient.tsx`**

Two-panel layout using existing grid patterns. Left: `<BudgetOverview />`, Right: `<SpendingActivity />`. Uses `trpc.budget.list.useQuery()`, `trpc.budget.categoryList.useQuery()`, `trpc.budget.monthlySummary.useQuery()`, `trpc.budget.surplus.useQuery()`.

State: `selectedCategoryId: string | null`, `currentMonth: Date`.

Empty state: show `<BudgetSetupSheet />`.

**Step 3: Create `BudgetOverview.tsx`**

- Overall monthly target at top (click to edit inline via input)
- Category list with `<CategoryBudgetRow />` components
- "Add category budget" button
- "Unbudgeted spending" section

**Step 4: Create `SpendingActivity.tsx`**

- When no category selected: 6-month trend bar chart using Recharts `<BarChart>` wrapped in `<ResponsiveContainer>`
- When category selected: transaction list + trend chart
- Surplus insight callout at bottom

**Step 5: Create `BudgetSetupSheet.tsx`**

Uses Sheet component from ui. Steps:
1. Monthly target input
2. Toggle for category limits
3. If toggled: category inputs pre-filled with 50/30/20 split
4. Submit calls `trpc.budget.setup.mutate()`

**Step 6: Create `CategoryBudgetRow.tsx`**

Single row: icon | name | "$spent / $budgeted" | progress bar | percentage. Click selects category in parent. Inline edit on budget amount.

**Step 7: Verify visually**

Run: `npm run dev`
Navigate to `/budget`. Should show setup flow.

**Step 8: Commit**

```
git commit -m "feat: add budget page with overview, spending activity, and setup flow"
```

---

## Task 9: Sidebar Navigation

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add Budget nav item**

Import `Wallet` from `lucide-react`.

Add to the appropriate nav group (after Cash Flow):
```typescript
{ href: "/budget", label: "Budget", icon: Wallet },
```

**Step 2: Verify**

Run: `npm run dev`
Sidebar shows "Budget" link. Clicking navigates to `/budget`.

**Step 3: Commit**

```
git commit -m "feat: add budget to sidebar navigation"
```

---

## Task 10: Bank Account Default Transaction Type

**Files:**
- Modify: bank account settings UI (find the component that manages bank account configuration)
- Modify: bank sync service (find where Basiq transactions are imported)

**Step 1: Add `defaultTransactionType` selector to bank account settings**

Find the bank account settings/edit component. Add a select dropdown:
- Label: "Default transaction type"
- Options: Property, Personal, Ask me each time
- Saves to `bankAccounts.defaultTransactionType`

**Step 2: Add routing logic to bank sync**

Find the Basiq sync service. After transactions are fetched, check `bankAccount.defaultTransactionType`:
- `'property'` → existing pipeline (no change)
- `'personal'` → insert into `personalTransactions` table with AI categorization
- `'ask'` or `null` → existing pipeline with a `needsReview` flag (defer to V2)

For V1, just implement `'property'` (existing) and `'personal'` paths. `'ask'` falls back to property.

**Step 3: Commit**

```
git commit -m "feat: add bank account transaction type routing for personal vs property"
```

---

## Task 11: E2E Test

**Files:**
- Create: `e2e/budget.spec.ts`

**Step 1: Write E2E test following `e2e/CLAUDE.md` patterns**

Use `authenticatedPage` fixture. Test:
1. Navigate to `/budget` — shows setup flow (empty state)
2. Complete budget setup — enter monthly target, save
3. Verify dashboard widget appears with budget data
4. Navigate to `/budget` — shows budget overview
5. Add a manual personal transaction
6. Verify progress bar updates
7. Clean up: delete budget and transaction

Follow existing E2E patterns from `e2e/fixtures/auth.ts`.

**Step 2: Run E2E**

Run: `npx playwright test e2e/budget.spec.ts`
Expected: PASS

**Step 3: Commit**

```
git commit -m "test: add budget feature E2E test"
```

---

## Task 12: Final Verification and Cleanup

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (900+ existing + ~30 new)

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run lint**

Run: `npx next lint`
Expected: No lint errors

**Step 4: Test visually end-to-end**

1. Navigate to dashboard — budget widget shows "Set up your budget"
2. Click CTA → navigate to `/budget`
3. Complete setup flow with $4,000 monthly target
4. Enable category budgets — verify 50/30/20 split pre-fills
5. Save — verify budget overview shows categories with $0 spent
6. Add manual transaction — verify progress bar updates
7. Return to dashboard — widget shows budget progress
8. Verify sidebar "Budget" link works

**Step 5: Final commit**

```
git commit -m "chore: budget feature cleanup and verification"
```

---

## Summary

| Task | Files | Tests | Description |
|------|-------|-------|-------------|
| 1 | 4 modified/created | Schema push | Enums, 3 tables, bank_accounts column |
| 2 | 4 created/modified | ~8 unit | Personal category repository |
| 3 | 4 created/modified | ~10 unit | Budget repository with spend tracking |
| 4 | 4 created/modified | ~10 unit | Personal transaction repository |
| 5 | 1 modified | Existing pass | Register repos in UnitOfWork |
| 6 | 4 created/modified | ~15 unit | Budget router (CRUD, setup, surplus) |
| 7 | 2 created/modified | Visual | Dashboard budget widget |
| 8 | 6 created | Visual | Budget page with overview + setup |
| 9 | 1 modified | Visual | Sidebar nav item |
| 10 | 2 modified | Integration | Bank account routing |
| 11 | 1 created | 1 E2E | End-to-end test |
| 12 | 0 | Full suite | Verification and cleanup |

**Total: ~15 new files, ~6 modified files, ~45 new tests, 12 commits**
