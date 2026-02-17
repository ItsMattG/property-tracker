import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import {
  budgets,
  personalCategories,
  personalTransactions,
  users,
} from "../../db/schema";
import { BudgetRepository } from "../budget.repository";
import type { DB } from "../base";

// Skip integration tests when no database is available (e.g. CI)
const hasDatabase = !!process.env.DATABASE_URL;

// Test database connection — uses DATABASE_URL from .env.local
const connectionString = process.env.DATABASE_URL ?? "";
const client = hasDatabase
  ? postgres(connectionString, { prepare: false, max: 1 })
  : (null as any);
const db = hasDatabase
  ? (drizzle(client, { schema }) as unknown as DB)
  : (null as any);

const TEST_USER_ID = "test-budget-repo-user";
const OTHER_USER_ID = "test-budget-repo-other";

describe.skipIf(!hasDatabase)("BudgetRepository", () => {
  let repo: BudgetRepository;
  let groceriesCategoryId: string;
  let diningCategoryId: string;

  beforeAll(async () => {
    repo = new BudgetRepository(db);

    // Ensure test users exist
    await (db as any)
      .insert(users)
      .values([
        {
          id: TEST_USER_ID,
          email: "budget-repo-test@example.com",
          name: "Budget Repo Test",
          emailVerified: true,
        },
        {
          id: OTHER_USER_ID,
          email: "budget-repo-other@example.com",
          name: "Other Budget User",
          emailVerified: true,
        },
      ])
      .onConflictDoNothing();

    // Seed categories for the test user
    const [groceries] = await (db as any)
      .insert(personalCategories)
      .values({
        userId: TEST_USER_ID,
        name: "Groceries",
        group: "needs",
        icon: "shopping-cart",
        sortOrder: 0,
      })
      .returning();
    groceriesCategoryId = groceries.id;

    const [dining] = await (db as any)
      .insert(personalCategories)
      .values({
        userId: TEST_USER_ID,
        name: "Dining Out",
        group: "wants",
        icon: "utensils",
        sortOrder: 1,
      })
      .returning();
    diningCategoryId = dining.id;
  });

  afterAll(async () => {
    // Clean up in correct order: transactions -> budgets -> categories -> users
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, TEST_USER_ID));
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, OTHER_USER_ID));
    await (db as any)
      .delete(budgets)
      .where(eq(budgets.userId, TEST_USER_ID));
    await (db as any)
      .delete(budgets)
      .where(eq(budgets.userId, OTHER_USER_ID));
    await (db as any)
      .delete(personalCategories)
      .where(eq(personalCategories.userId, TEST_USER_ID));
    await (db as any)
      .delete(personalCategories)
      .where(eq(personalCategories.userId, OTHER_USER_ID));
    await (db as any).delete(users).where(eq(users.id, TEST_USER_ID));
    await (db as any).delete(users).where(eq(users.id, OTHER_USER_ID));
    await client.end();
  });

  beforeEach(async () => {
    // Clean slate: remove budgets and transactions before each test
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, TEST_USER_ID));
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, OTHER_USER_ID));
    await (db as any)
      .delete(budgets)
      .where(eq(budgets.userId, TEST_USER_ID));
    await (db as any)
      .delete(budgets)
      .where(eq(budgets.userId, OTHER_USER_ID));
  });

  describe("create", () => {
    it("creates an overall budget (null categoryId)", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "5000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.personalCategoryId).toBeNull();
      expect(result.monthlyAmount).toBe("5000.00");
      expect(result.effectiveTo).toBeNull();
    });

    it("creates a category budget", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.personalCategoryId).toBe(groceriesCategoryId);
      expect(result.monthlyAmount).toBe("800.00");
    });
  });

  describe("findByUser", () => {
    it("returns budgets with computed spend amounts for a given month", async () => {
      // Create a category budget for January 2026
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      // Add transactions for January 2026 (expenses are negative)
      await (db as any).insert(personalTransactions).values([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "Woolworths",
          amount: "-120.50",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 15),
          description: "Coles",
          amount: "-85.30",
          personalCategoryId: groceriesCategoryId,
        },
      ]);

      const result = await repo.findByUser(TEST_USER_ID, new Date(2026, 0, 15));

      expect(result).toHaveLength(1);
      expect(result[0].monthlyAmount).toBe("800.00");
      expect(result[0].categoryName).toBe("Groceries");
      expect(result[0].categoryIcon).toBe("shopping-cart");
      expect(result[0].categoryGroup).toBe("needs");
      // spent = |(-120.50) + (-85.30)| = 205.80
      expect(result[0].spent).toBeCloseTo(205.8, 2);
    });

    it("returns overall budget with total spend across all categories", async () => {
      // Create an overall budget
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "5000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      // Add transactions across multiple categories
      await (db as any).insert(personalTransactions).values([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "Woolworths",
          amount: "-120.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 10),
          description: "Restaurant",
          amount: "-80.00",
          personalCategoryId: diningCategoryId,
        },
      ]);

      const result = await repo.findByUser(TEST_USER_ID, new Date(2026, 0, 15));

      expect(result).toHaveLength(1);
      expect(result[0].personalCategoryId).toBeNull();
      expect(result[0].categoryName).toBeNull();
      // Total spend = |(-120.00) + (-80.00)| = 200.00
      expect(result[0].spent).toBeCloseTo(200.0, 2);
    });

    it("excludes budgets not effective in the queried month", async () => {
      // Budget effective only in January 2026
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: new Date(2026, 0, 31),
      });

      // Query for February 2026 — should not find it
      const result = await repo.findByUser(TEST_USER_ID, new Date(2026, 1, 15));

      expect(result).toHaveLength(0);
    });

    it("returns zero spend when no transactions exist", async () => {
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const result = await repo.findByUser(TEST_USER_ID, new Date(2026, 0, 15));

      expect(result).toHaveLength(1);
      expect(result[0].spent).toBe(0);
    });
  });

  describe("findById", () => {
    it("returns a budget by id scoped to user", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const result = await repo.findById(created.id, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.monthlyAmount).toBe("800.00");
    });

    it("returns null for non-existent budget", async () => {
      const result = await repo.findById(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID
      );

      expect(result).toBeNull();
    });

    it("returns null when budget belongs to another user", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "3000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const result = await repo.findById(created.id, TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("findOverallBudget", () => {
    it("returns the overall target (null categoryId)", async () => {
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "5000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      // Also create a category budget — should not be returned
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const result = await repo.findOverallBudget(TEST_USER_ID, new Date(2026, 0, 15));

      expect(result).not.toBeNull();
      expect(result!.personalCategoryId).toBeNull();
      expect(result!.monthlyAmount).toBe("5000.00");
    });

    it("returns null when no overall budget exists", async () => {
      // Only category budget exists
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const result = await repo.findOverallBudget(TEST_USER_ID, new Date(2026, 0, 15));

      expect(result).toBeNull();
    });

    it("returns null when overall budget is outside effective range", async () => {
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "5000.00",
        effectiveFrom: new Date(2026, 2, 1), // March 2026
        effectiveTo: null,
      });

      const result = await repo.findOverallBudget(TEST_USER_ID, new Date(2026, 0, 15));

      expect(result).toBeNull();
    });
  });

  describe("getMonthlySpendByCategory", () => {
    it("aggregates personal transactions by category", async () => {
      await (db as any).insert(personalTransactions).values([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "Woolworths",
          amount: "-120.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 10),
          description: "Coles",
          amount: "-80.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 12),
          description: "Restaurant",
          amount: "-50.00",
          personalCategoryId: diningCategoryId,
        },
        // Income should be excluded
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 15),
          description: "Salary",
          amount: "5000.00",
          personalCategoryId: null,
        },
      ]);

      const result = await repo.getMonthlySpendByCategory(
        TEST_USER_ID,
        new Date(2026, 0, 15)
      );

      expect(result.length).toBeGreaterThanOrEqual(2);

      const groceries = result.find((r) => r.categoryId === groceriesCategoryId);
      expect(groceries).toBeDefined();
      expect(groceries!.total).toBeCloseTo(200.0, 2);

      const dining = result.find((r) => r.categoryId === diningCategoryId);
      expect(dining).toBeDefined();
      expect(dining!.total).toBeCloseTo(50.0, 2);
    });

    it("returns empty array when no transactions exist", async () => {
      const result = await repo.getMonthlySpendByCategory(
        TEST_USER_ID,
        new Date(2026, 0, 15)
      );

      expect(result).toEqual([]);
    });

    it("excludes transactions from other months", async () => {
      await (db as any).insert(personalTransactions).values([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "January expense",
          amount: "-100.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 1, 5),
          description: "February expense",
          amount: "-200.00",
          personalCategoryId: groceriesCategoryId,
        },
      ]);

      const result = await repo.getMonthlySpendByCategory(
        TEST_USER_ID,
        new Date(2026, 0, 15) // Query for January
      );

      expect(result).toHaveLength(1);
      expect(result[0].total).toBeCloseTo(100.0, 2);
    });
  });

  describe("getAverageMonthlyExpenses", () => {
    it("returns average over N months", async () => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10);

      await (db as any).insert(personalTransactions).values([
        {
          userId: TEST_USER_ID,
          date: lastMonth,
          description: "Last month expense",
          amount: "-300.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: twoMonthsAgo,
          description: "Two months ago expense",
          amount: "-600.00",
          personalCategoryId: groceriesCategoryId,
        },
      ]);

      const result = await repo.getAverageMonthlyExpenses(TEST_USER_ID, 3);

      // Total = 900, over 3 months = 300
      expect(result).toBeCloseTo(300.0, 2);
    });

    it("returns 0 when no transactions exist", async () => {
      const result = await repo.getAverageMonthlyExpenses(TEST_USER_ID, 3);

      expect(result).toBe(0);
    });

    it("excludes income (positive amounts)", async () => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10);

      await (db as any).insert(personalTransactions).values([
        {
          userId: TEST_USER_ID,
          date: lastMonth,
          description: "Expense",
          amount: "-400.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: lastMonth,
          description: "Income",
          amount: "5000.00",
          personalCategoryId: null,
        },
      ]);

      const result = await repo.getAverageMonthlyExpenses(TEST_USER_ID, 1);

      // Only the expense counts: 400 / 1 = 400
      expect(result).toBeCloseTo(400.0, 2);
    });
  });

  describe("update", () => {
    it("changes the monthly amount", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const updated = await repo.update(created.id, TEST_USER_ID, {
        monthlyAmount: "1000.00",
      });

      expect(updated).not.toBeNull();
      expect(updated!.monthlyAmount).toBe("1000.00");
    });

    it("returns null when updating non-existent budget", async () => {
      const result = await repo.update(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID,
        { monthlyAmount: "999.00" }
      );

      expect(result).toBeNull();
    });

    it("returns null when updating another user's budget", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "3000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const result = await repo.update(created.id, TEST_USER_ID, {
        monthlyAmount: "999.00",
      });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the budget", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: groceriesCategoryId,
        monthlyAmount: "800.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      await repo.delete(created.id, TEST_USER_ID);

      const result = await repo.findById(created.id, TEST_USER_ID);
      expect(result).toBeNull();
    });

    it("does not delete another user's budget", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "3000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      await repo.delete(created.id, TEST_USER_ID);

      // Budget should still exist for other user
      const result = await (db as any).query.budgets.findFirst({
        where: eq(budgets.id, created.id),
      });
      expect(result).not.toBeNull();
    });
  });

  describe("data isolation", () => {
    it("only returns budgets for the requesting user", async () => {
      await repo.create({
        userId: TEST_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "5000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      await repo.create({
        userId: OTHER_USER_ID,
        personalCategoryId: null,
        monthlyAmount: "3000.00",
        effectiveFrom: new Date(2026, 0, 1),
        effectiveTo: null,
      });

      const result = await repo.findByUser(TEST_USER_ID, new Date(2026, 0, 15));

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(TEST_USER_ID);
      expect(result[0].monthlyAmount).toBe("5000.00");
    });
  });
});
