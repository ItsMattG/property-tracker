import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { categorizationRules, users } from "../../db/schema";
import { CategorizationRuleRepository } from "../categorization-rule.repository";
import type { DB } from "../base";

// Skip integration tests when no database is available (e.g. CI)
const hasDatabase = !!process.env.DATABASE_URL;

const connectionString = process.env.DATABASE_URL ?? "";
const client = hasDatabase
  ? postgres(connectionString, { prepare: false, max: 1 })
  : (null as unknown as ReturnType<typeof postgres>);
const db = hasDatabase
  ? (drizzle(client, { schema }) as unknown as DB)
  : (null as unknown as DB);

const TEST_USER_ID = "test-cat-rule-repo-user";
const OTHER_USER_ID = "test-cat-rule-repo-other";

describe.skipIf(!hasDatabase)("CategorizationRuleRepository", () => {
  let repo: CategorizationRuleRepository;

  beforeAll(async () => {
    repo = new CategorizationRuleRepository(db);

    // Ensure test users exist
    await (db as DB)
      .insert(users)
      .values([
        {
          id: TEST_USER_ID,
          email: "cat-rule-repo-test@example.com",
          name: "Cat Rule Repo Test",
          emailVerified: true,
        },
        {
          id: OTHER_USER_ID,
          email: "cat-rule-repo-other@example.com",
          name: "Other Cat Rule User",
          emailVerified: true,
        },
      ])
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    // Clean rules for test user
    await (db as DB)
      .delete(categorizationRules)
      .where(eq(categorizationRules.userId, TEST_USER_ID));
    await (db as DB)
      .delete(categorizationRules)
      .where(eq(categorizationRules.userId, OTHER_USER_ID));
  });

  afterAll(async () => {
    // Cleanup
    await (db as DB)
      .delete(categorizationRules)
      .where(eq(categorizationRules.userId, TEST_USER_ID));
    await (db as DB)
      .delete(categorizationRules)
      .where(eq(categorizationRules.userId, OTHER_USER_ID));
    await (db as DB).delete(users).where(eq(users.id, TEST_USER_ID));
    await (db as DB).delete(users).where(eq(users.id, OTHER_USER_ID));
    await client.end();
  });

  it("creates and finds a rule", async () => {
    const rule = await repo.create({
      userId: TEST_USER_ID,
      name: "Body Corp Rule",
      merchantPattern: "Body Corporate",
      matchType: "contains",
      targetCategory: "body_corporate",
      priority: 5,
    });

    expect(rule.id).toBeDefined();
    expect(rule.name).toBe("Body Corp Rule");
    expect(rule.merchantPattern).toBe("Body Corporate");
    expect(rule.matchType).toBe("contains");
    expect(rule.priority).toBe(5);
    expect(rule.isActive).toBe(true);
    expect(rule.matchCount).toBe(0);

    const found = await repo.findById(rule.id, TEST_USER_ID);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Body Corp Rule");
  });

  it("findByUser returns rules sorted by priority descending", async () => {
    await repo.create({
      userId: TEST_USER_ID,
      name: "Low Priority",
      merchantPattern: "low",
      matchType: "contains",
      targetCategory: "uncategorized",
      priority: 1,
    });
    await repo.create({
      userId: TEST_USER_ID,
      name: "High Priority",
      merchantPattern: "high",
      matchType: "contains",
      targetCategory: "insurance",
      priority: 10,
    });

    const rules = await repo.findByUser(TEST_USER_ID);
    expect(rules).toHaveLength(2);
    expect(rules[0].name).toBe("High Priority");
    expect(rules[1].name).toBe("Low Priority");
  });

  it("findActiveByUser excludes inactive rules", async () => {
    await repo.create({
      userId: TEST_USER_ID,
      name: "Active Rule",
      merchantPattern: "active",
      matchType: "contains",
      targetCategory: "insurance",
      isActive: true,
    });
    await repo.create({
      userId: TEST_USER_ID,
      name: "Inactive Rule",
      merchantPattern: "inactive",
      matchType: "contains",
      targetCategory: "insurance",
      isActive: false,
    });

    const rules = await repo.findActiveByUser(TEST_USER_ID);
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe("Active Rule");
  });

  it("scopes findById to the user", async () => {
    const rule = await repo.create({
      userId: TEST_USER_ID,
      name: "My Rule",
      merchantPattern: "test",
      matchType: "contains",
      targetCategory: "insurance",
    });

    // Other user cannot see this rule
    const notFound = await repo.findById(rule.id, OTHER_USER_ID);
    expect(notFound).toBeNull();
  });

  it("counts rules for a user", async () => {
    await repo.create({
      userId: TEST_USER_ID,
      name: "Rule 1",
      merchantPattern: "test1",
      matchType: "contains",
      targetCategory: "insurance",
    });
    await repo.create({
      userId: TEST_USER_ID,
      name: "Rule 2",
      merchantPattern: "test2",
      matchType: "contains",
      targetCategory: "insurance",
    });
    // Different user
    await repo.create({
      userId: OTHER_USER_ID,
      name: "Other Rule",
      merchantPattern: "other",
      matchType: "contains",
      targetCategory: "insurance",
    });

    const count = await repo.countByUser(TEST_USER_ID);
    expect(count).toBe(2);
  });

  it("updates a rule", async () => {
    const rule = await repo.create({
      userId: TEST_USER_ID,
      name: "Original",
      merchantPattern: "test",
      matchType: "contains",
      targetCategory: "insurance",
    });

    const updated = await repo.update(rule.id, TEST_USER_ID, {
      name: "Updated",
      priority: 99,
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated");
    expect(updated!.priority).toBe(99);
  });

  it("scopes update to the user", async () => {
    const rule = await repo.create({
      userId: TEST_USER_ID,
      name: "My Rule",
      merchantPattern: "test",
      matchType: "contains",
      targetCategory: "insurance",
    });

    const result = await repo.update(rule.id, OTHER_USER_ID, { name: "Hacked" });
    expect(result).toBeNull();
  });

  it("deletes a rule", async () => {
    const rule = await repo.create({
      userId: TEST_USER_ID,
      name: "To Delete",
      merchantPattern: "delete",
      matchType: "contains",
      targetCategory: "insurance",
    });

    await repo.delete(rule.id, TEST_USER_ID);
    const found = await repo.findById(rule.id, TEST_USER_ID);
    expect(found).toBeNull();
  });

  it("increments match count", async () => {
    const rule = await repo.create({
      userId: TEST_USER_ID,
      name: "Counter Rule",
      merchantPattern: "counter",
      matchType: "contains",
      targetCategory: "insurance",
    });

    expect(rule.matchCount).toBe(0);

    await repo.incrementMatchCount(rule.id);
    await repo.incrementMatchCount(rule.id);

    const updated = await repo.findById(rule.id, TEST_USER_ID);
    expect(updated!.matchCount).toBe(2);
  });
});
