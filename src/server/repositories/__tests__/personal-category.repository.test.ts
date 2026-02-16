import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { personalCategories, users } from "../../db/schema";
import { PersonalCategoryRepository } from "../personal-category.repository";
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

const TEST_USER_ID = "test-personal-cat-repo-user";
const OTHER_USER_ID = "test-personal-cat-repo-other";

describe.skipIf(!hasDatabase)("PersonalCategoryRepository", () => {
  let repo: PersonalCategoryRepository;

  beforeAll(async () => {
    repo = new PersonalCategoryRepository(db);

    // Ensure test users exist (users table requires these)
    await (db as any)
      .insert(users)
      .values([
        {
          id: TEST_USER_ID,
          email: "personal-cat-repo-test@example.com",
          name: "Personal Cat Repo Test",
          emailVerified: true,
        },
        {
          id: OTHER_USER_ID,
          email: "personal-cat-repo-other@example.com",
          name: "Other User",
          emailVerified: true,
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Clean up: delete test categories, then users
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
    // Clean slate: remove all test categories before each test
    await (db as any)
      .delete(personalCategories)
      .where(eq(personalCategories.userId, TEST_USER_ID));
    await (db as any)
      .delete(personalCategories)
      .where(eq(personalCategories.userId, OTHER_USER_ID));
  });

  describe("seedDefaults", () => {
    it("creates 15 default categories", async () => {
      const result = await repo.seedDefaults(TEST_USER_ID);

      expect(result).toHaveLength(15);
    });

    it("creates categories with correct group distribution", async () => {
      const result = await repo.seedDefaults(TEST_USER_ID);

      const needs = result.filter((c) => c.group === "needs");
      const wants = result.filter((c) => c.group === "wants");
      const savings = result.filter((c) => c.group === "savings");

      expect(needs).toHaveLength(6);
      expect(wants).toHaveLength(6);
      expect(savings).toHaveLength(3);
    });

    it("assigns correct user id to all categories", async () => {
      const result = await repo.seedDefaults(TEST_USER_ID);

      for (const cat of result) {
        expect(cat.userId).toBe(TEST_USER_ID);
      }
    });

    it("assigns sequential sort orders", async () => {
      const result = await repo.seedDefaults(TEST_USER_ID);

      const sortOrders = result.map((c) => c.sortOrder).sort((a, b) => a - b);
      expect(sortOrders).toEqual(
        Array.from({ length: 15 }, (_, i) => i)
      );
    });
  });

  describe("findByUser", () => {
    it("returns all categories for a user ordered by sortOrder", async () => {
      await repo.seedDefaults(TEST_USER_ID);

      const result = await repo.findByUser(TEST_USER_ID);

      expect(result).toHaveLength(15);
      // Verify ordering
      for (let i = 1; i < result.length; i++) {
        expect(result[i].sortOrder).toBeGreaterThanOrEqual(
          result[i - 1].sortOrder
        );
      }
    });

    it("does not return categories from other users", async () => {
      await repo.seedDefaults(TEST_USER_ID);
      await repo.seedDefaults(OTHER_USER_ID);

      const result = await repo.findByUser(TEST_USER_ID);

      expect(result).toHaveLength(15);
      for (const cat of result) {
        expect(cat.userId).toBe(TEST_USER_ID);
      }
    });

    it("returns empty array when user has no categories", async () => {
      const result = await repo.findByUser(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("creates a custom category", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        name: "Custom Category",
        group: "wants",
        icon: "star",
        sortOrder: 99,
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Custom Category");
      expect(result.group).toBe("wants");
      expect(result.icon).toBe("star");
      expect(result.sortOrder).toBe(99);
      expect(result.userId).toBe(TEST_USER_ID);
    });

    it("uses default icon when not specified", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        name: "No Icon",
      });

      expect(result.icon).toBe("circle");
    });

    it("uses default sortOrder when not specified", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        name: "No Sort Order",
      });

      expect(result.sortOrder).toBe(0);
    });
  });

  describe("findById", () => {
    it("returns a category by id scoped to user", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        name: "Find Me",
        group: "needs",
      });

      const result = await repo.findById(created.id, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.name).toBe("Find Me");
    });

    it("returns null for non-existent category", async () => {
      const result = await repo.findById(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID
      );

      expect(result).toBeNull();
    });

    it("returns null when category belongs to another user", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        name: "Not Mine",
        group: "wants",
      });

      const result = await repo.findById(created.id, TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("modifies and returns the updated category", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        name: "Old Name",
        group: "needs",
      });

      const result = await repo.update(created.id, TEST_USER_ID, {
        name: "New Name",
        group: "wants",
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe("New Name");
      expect(result!.group).toBe("wants");
    });

    it("returns null when updating non-existent category", async () => {
      const result = await repo.update(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID,
        { name: "Ghost" }
      );

      expect(result).toBeNull();
    });

    it("returns null when updating category of another user", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        name: "Not Mine",
        group: "needs",
      });

      const result = await repo.update(created.id, TEST_USER_ID, {
        name: "Hijacked",
      });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the category", async () => {
      const created = await repo.create({
        userId: TEST_USER_ID,
        name: "Delete Me",
        group: "needs",
      });

      await repo.delete(created.id, TEST_USER_ID);

      const result = await repo.findById(created.id, TEST_USER_ID);
      expect(result).toBeNull();
    });

    it("does not delete another user's category", async () => {
      const created = await repo.create({
        userId: OTHER_USER_ID,
        name: "Protected",
        group: "wants",
      });

      await repo.delete(created.id, TEST_USER_ID);

      // Category should still exist for other user
      const result = await (db as any).query.personalCategories.findFirst({
        where: eq(personalCategories.id, created.id),
      });
      expect(result).not.toBeNull();
    });
  });
});
