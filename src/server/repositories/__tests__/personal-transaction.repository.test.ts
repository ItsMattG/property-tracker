import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import {
  personalTransactions,
  personalCategories,
  users,
} from "../../db/schema";
import { PersonalTransactionRepository } from "../personal-transaction.repository";
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

const TEST_USER_ID = "test-personal-txn-repo-user";
const OTHER_USER_ID = "test-personal-txn-repo-other";

describe.skipIf(!hasDatabase)("PersonalTransactionRepository", () => {
  let repo: PersonalTransactionRepository;
  let groceriesCategoryId: string;
  let diningCategoryId: string;

  beforeAll(async () => {
    repo = new PersonalTransactionRepository(db);

    // Ensure test users exist
    await (db as any)
      .insert(users)
      .values([
        {
          id: TEST_USER_ID,
          email: "personal-txn-repo-test@example.com",
          name: "Personal Txn Repo Test",
          emailVerified: true,
        },
        {
          id: OTHER_USER_ID,
          email: "personal-txn-repo-other@example.com",
          name: "Other Txn User",
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
    // Clean up in correct order: transactions -> categories -> users
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, TEST_USER_ID));
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, OTHER_USER_ID));
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
    // Clean slate: remove all test transactions before each test
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, TEST_USER_ID));
    await (db as any)
      .delete(personalTransactions)
      .where(eq(personalTransactions.userId, OTHER_USER_ID));
  });

  describe("create", () => {
    it("creates a single transaction and returns all fields", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Woolworths Weekly Shop",
        amount: "-120.50",
        personalCategoryId: groceriesCategoryId,
        notes: "Regular weekly shop",
        isRecurring: false,
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.date).toEqual(new Date(2026, 0, 15));
      expect(result.description).toBe("Woolworths Weekly Shop");
      expect(result.amount).toBe("-120.50");
      expect(result.personalCategoryId).toBe(groceriesCategoryId);
      expect(result.notes).toBe("Regular weekly shop");
      expect(result.isRecurring).toBe(false);
      expect(result.bankAccountId).toBeNull();
      expect(result.basiqTransactionId).toBeNull();
      expect(result.suggestedCategoryId).toBeNull();
      expect(result.suggestionConfidence).toBeNull();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("creates a transaction with basiqTransactionId", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 20),
        description: "Bank Synced Transaction",
        amount: "-50.00",
        basiqTransactionId: "basiq-txn-001",
      });

      expect(result.basiqTransactionId).toBe("basiq-txn-001");
    });
  });

  describe("createMany", () => {
    it("bulk inserts multiple transactions", async () => {
      const result = await repo.createMany([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "Transaction 1",
          amount: "-30.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 10),
          description: "Transaction 2",
          amount: "-45.00",
          personalCategoryId: diningCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 15),
          description: "Transaction 3",
          amount: "2000.00",
        },
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].description).toBe("Transaction 1");
      expect(result[1].description).toBe("Transaction 2");
      expect(result[2].description).toBe("Transaction 3");
      expect(result[2].amount).toBe("2000.00");
    });
  });

  describe("findByUser", () => {
    it("returns transactions with category info ordered by date desc", async () => {
      await repo.createMany([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "Old Transaction",
          amount: "-30.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 20),
          description: "Recent Transaction",
          amount: "-50.00",
          personalCategoryId: diningCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 10),
          description: "Middle Transaction",
          amount: "-25.00",
        },
      ]);

      const { transactions, total } = await repo.findByUser(TEST_USER_ID, {});

      expect(total).toBe(3);
      expect(transactions).toHaveLength(3);
      // Ordered by date desc: 20th, 10th, 5th
      expect(transactions[0].description).toBe("Recent Transaction");
      expect(transactions[1].description).toBe("Middle Transaction");
      expect(transactions[2].description).toBe("Old Transaction");
      // Category info populated
      expect(transactions[0].categoryName).toBe("Dining Out");
      expect(transactions[0].categoryIcon).toBe("utensils");
      expect(transactions[2].categoryName).toBe("Groceries");
      expect(transactions[2].categoryIcon).toBe("shopping-cart");
      // No category = null
      expect(transactions[1].categoryName).toBeNull();
      expect(transactions[1].categoryIcon).toBeNull();
    });

    it("filters by categoryId", async () => {
      await repo.createMany([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "Grocery 1",
          amount: "-30.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 10),
          description: "Dining 1",
          amount: "-50.00",
          personalCategoryId: diningCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 15),
          description: "Grocery 2",
          amount: "-25.00",
          personalCategoryId: groceriesCategoryId,
        },
      ]);

      const { transactions, total } = await repo.findByUser(TEST_USER_ID, {
        categoryId: groceriesCategoryId,
      });

      expect(total).toBe(2);
      expect(transactions).toHaveLength(2);
      for (const txn of transactions) {
        expect(txn.personalCategoryId).toBe(groceriesCategoryId);
      }
    });

    it("filters by date range", async () => {
      await repo.createMany([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "Before range",
          amount: "-10.00",
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 10),
          description: "In range start",
          amount: "-20.00",
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 20),
          description: "In range end",
          amount: "-30.00",
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 25),
          description: "After range",
          amount: "-40.00",
        },
      ]);

      const { transactions, total } = await repo.findByUser(TEST_USER_ID, {
        startDate: new Date(2026, 0, 10),
        endDate: new Date(2026, 0, 20),
      });

      expect(total).toBe(2);
      expect(transactions).toHaveLength(2);
      expect(transactions.map((t) => t.description).sort()).toEqual([
        "In range end",
        "In range start",
      ]);
    });

    it("supports pagination with limit and offset", async () => {
      // Create 5 transactions
      await repo.createMany(
        Array.from({ length: 5 }, (_, i) => ({
          userId: TEST_USER_ID,
          date: new Date(2026, 0, i + 1),
          description: `Txn ${i + 1}`,
          amount: "-10.00",
        }))
      );

      // Page 1: limit=2, offset=0
      const page1 = await repo.findByUser(TEST_USER_ID, { limit: 2, offset: 0 });
      expect(page1.total).toBe(5);
      expect(page1.transactions).toHaveLength(2);
      // Ordered by date desc, so newest first
      expect(page1.transactions[0].description).toBe("Txn 5");
      expect(page1.transactions[1].description).toBe("Txn 4");

      // Page 2: limit=2, offset=2
      const page2 = await repo.findByUser(TEST_USER_ID, { limit: 2, offset: 2 });
      expect(page2.total).toBe(5);
      expect(page2.transactions).toHaveLength(2);
      expect(page2.transactions[0].description).toBe("Txn 3");
      expect(page2.transactions[1].description).toBe("Txn 2");

      // Page 3: limit=2, offset=4
      const page3 = await repo.findByUser(TEST_USER_ID, { limit: 2, offset: 4 });
      expect(page3.total).toBe(5);
      expect(page3.transactions).toHaveLength(1);
      expect(page3.transactions[0].description).toBe("Txn 1");
    });
  });

  describe("findById", () => {
    it("returns a transaction by id scoped to user", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Find me",
        amount: "-42.00",
        personalCategoryId: groceriesCategoryId,
      });

      const result = await repo.findById(created.id, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.description).toBe("Find me");
      expect(result!.amount).toBe("-42.00");
    });

    it("returns null for non-existent transaction", async () => {
      const result = await repo.findById(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID
      );

      expect(result).toBeNull();
    });

    it("returns null when transaction belongs to another user", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Other user's transaction",
        amount: "-100.00",
      });

      const result = await repo.findById(created.id, TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("modifies and returns the updated transaction", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Original description",
        amount: "-50.00",
      });

      const result = await repo.update(created.id, TEST_USER_ID, {
        description: "Updated description",
        amount: "-75.00",
        personalCategoryId: groceriesCategoryId,
        notes: "Added a note",
      });

      expect(result).not.toBeNull();
      expect(result!.description).toBe("Updated description");
      expect(result!.amount).toBe("-75.00");
      expect(result!.personalCategoryId).toBe(groceriesCategoryId);
      expect(result!.notes).toBe("Added a note");
    });

    it("returns null when updating non-existent transaction", async () => {
      const result = await repo.update(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID,
        { description: "Ghost" }
      );

      expect(result).toBeNull();
    });

    it("returns null when updating another user's transaction", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Not mine",
        amount: "-100.00",
      });

      const result = await repo.update(created.id, TEST_USER_ID, {
        description: "Hijacked",
      });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the transaction", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Delete me",
        amount: "-30.00",
      });

      await repo.delete(created.id, TEST_USER_ID);

      const result = await repo.findById(created.id, TEST_USER_ID);
      expect(result).toBeNull();
    });

    it("does not delete another user's transaction", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Protected",
        amount: "-100.00",
      });

      await repo.delete(created.id, TEST_USER_ID);

      // Transaction should still exist for other user
      const result = await (db as any).query.personalTransactions.findFirst({
        where: eq(personalTransactions.id, created.id),
      });
      expect(result).not.toBeNull();
    });
  });

  describe("findByBasiqId", () => {
    it("finds a transaction by basiq external ID", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Bank synced",
        amount: "-60.00",
        basiqTransactionId: "basiq-unique-123",
      });

      const result = await repo.findByBasiqId("basiq-unique-123");

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.description).toBe("Bank synced");
    });

    it("returns null when basiq ID not found", async () => {
      const result = await repo.findByBasiqId("basiq-nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getMonthlySummary", () => {
    it("groups by month with separate income and expenses", async () => {
      // January 2026 transactions
      await repo.createMany([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 5),
          description: "January Expense 1",
          amount: "-120.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 15),
          description: "January Expense 2",
          amount: "-80.00",
          personalCategoryId: diningCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 0, 20),
          description: "January Income",
          amount: "5000.00",
        },
      ]);

      // February 2026 transactions
      await repo.createMany([
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 1, 5),
          description: "February Expense",
          amount: "-200.00",
          personalCategoryId: groceriesCategoryId,
        },
        {
          userId: TEST_USER_ID,
          date: new Date(2026, 1, 15),
          description: "February Income",
          amount: "4500.00",
        },
      ]);

      const result = await repo.getMonthlySummary(TEST_USER_ID, 6);

      expect(result.length).toBeGreaterThanOrEqual(2);

      const jan = result.find((r) => r.month === "2026-01");
      expect(jan).toBeDefined();
      expect(jan!.income).toBeCloseTo(5000.0, 2);
      expect(jan!.expenses).toBeCloseTo(200.0, 2); // |(-120) + (-80)| = 200

      const feb = result.find((r) => r.month === "2026-02");
      expect(feb).toBeDefined();
      expect(feb!.income).toBeCloseTo(4500.0, 2);
      expect(feb!.expenses).toBeCloseTo(200.0, 2);

      // Verify chronological ordering
      const months = result.map((r) => r.month);
      const sorted = [...months].sort();
      expect(months).toEqual(sorted);
    });

    it("returns empty array for no data", async () => {
      const result = await repo.getMonthlySummary(TEST_USER_ID, 3);

      expect(result).toEqual([]);
    });
  });

  describe("data isolation", () => {
    it("findByUser does not return other users' transactions", async () => {
      await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 15),
        description: "My transaction",
        amount: "-50.00",
      });

      await repo.create({
        userId: OTHER_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Other user's transaction",
        amount: "-75.00",
      });

      const { transactions, total } = await repo.findByUser(TEST_USER_ID, {});

      expect(total).toBe(1);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].userId).toBe(TEST_USER_ID);
      expect(transactions[0].description).toBe("My transaction");
    });

    it("getMonthlySummary only includes the user's transactions", async () => {
      await repo.create({
        userId: TEST_USER_ID,
        date: new Date(2026, 0, 15),
        description: "My expense",
        amount: "-100.00",
      });

      await repo.create({
        userId: OTHER_USER_ID,
        date: new Date(2026, 0, 15),
        description: "Other expense",
        amount: "-500.00",
      });

      const result = await repo.getMonthlySummary(TEST_USER_ID, 6);

      const jan = result.find((r) => r.month === "2026-01");
      expect(jan).toBeDefined();
      expect(jan!.expenses).toBeCloseTo(100.0, 2);
    });
  });
});
