import { eq } from "drizzle-orm";
import type postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createIntegrationDb,
  testUserId,
} from "../../__tests__/integration-utils";
import { properties, propertyValues, users } from "../../db/schema";
import type { db as DbInstance } from "../../db";
import { getLatestPropertyValues } from "../portfolio-helpers";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("getLatestPropertyValues (integration)", () => {
  let db: typeof DbInstance;
  let sql: ReturnType<typeof postgres>;
  const userId = testUserId();

  // Track inserted property IDs for cleanup
  const insertedPropertyIds: string[] = [];

  beforeAll(async () => {
    const conn = createIntegrationDb();
    db = conn.db;
    sql = conn.sql;

    await db.insert(users).values({
      id: userId,
      name: "Integration Test User",
      email: `${userId}@test.local`,
    });
  });

  afterEach(async () => {
    // Clean up property values and properties created during tests
    if (insertedPropertyIds.length > 0) {
      await db
        .delete(propertyValues)
        .where(eq(propertyValues.userId, userId));
      for (const propId of insertedPropertyIds) {
        await db.delete(properties).where(eq(properties.id, propId));
      }
      insertedPropertyIds.length = 0;
    }
  });

  afterAll(async () => {
    if (!db) return;
    // Clean up any remaining property values/properties, then the user
    await db.delete(propertyValues).where(eq(propertyValues.userId, userId));
    await db.delete(properties).where(eq(properties.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await sql.end();
  });

  async function insertProperty(overrides: Partial<typeof properties.$inferInsert> = {}) {
    const [prop] = await db
      .insert(properties)
      .values({
        userId,
        address: "123 Test St",
        suburb: "Testville",
        state: "NSW",
        postcode: "2000",
        purchasePrice: "500000",
        purchaseDate: "2024-01-01",
        ...overrides,
      })
      .returning();
    insertedPropertyIds.push(prop.id);
    return prop;
  }

  async function insertPropertyValue(
    propertyId: string,
    estimatedValue: string,
    valueDate: string,
  ) {
    const [val] = await db
      .insert(propertyValues)
      .values({
        propertyId,
        userId,
        estimatedValue,
        valueDate,
        source: "manual",
      })
      .returning();
    return val;
  }

  it("returns only the latest value per property (DISTINCT ON)", async () => {
    const prop = await insertProperty();

    await insertPropertyValue(prop.id, "400000", "2025-01-01");
    await insertPropertyValue(prop.id, "500000", "2025-06-01");
    await insertPropertyValue(prop.id, "600000", "2026-01-01");

    const result = await getLatestPropertyValues(db, userId, [prop.id]);

    expect(result.size).toBe(1);
    expect(result.get(prop.id)).toBe(600000);
  });

  it("handles multiple properties with inArray binding (regression)", async () => {
    const prop1 = await insertProperty({ address: "1 Regression St" });
    const prop2 = await insertProperty({ address: "2 Regression St" });
    const prop3 = await insertProperty({ address: "3 Regression St" });

    await insertPropertyValue(prop1.id, "400000", "2025-01-01");
    await insertPropertyValue(prop2.id, "500000", "2025-01-01");
    await insertPropertyValue(prop3.id, "600000", "2025-01-01");

    // This was the original production bug — inArray with multiple IDs caused
    // incorrect SQL parameter binding. It should NOT throw.
    const result = await getLatestPropertyValues(db, userId, [
      prop1.id,
      prop2.id,
      prop3.id,
    ]);

    expect(result.size).toBe(3);
    expect(result.get(prop1.id)).toBe(400000);
    expect(result.get(prop2.id)).toBe(500000);
    expect(result.get(prop3.id)).toBe(600000);
  });

  it("filters by beforeDate correctly", async () => {
    const prop = await insertProperty();

    await insertPropertyValue(prop.id, "500000", "2025-06-01");
    await insertPropertyValue(prop.id, "600000", "2026-01-15");
    await insertPropertyValue(prop.id, "700000", "2026-02-01");

    // Without filter — should return the latest (700000)
    const allResult = await getLatestPropertyValues(db, userId, [prop.id]);
    expect(allResult.get(prop.id)).toBe(700000);

    // With beforeDate "2026-02-01" — should exclude 2026-02-01 (lt, not lte)
    // and return the next latest: 600000
    const filteredResult = await getLatestPropertyValues(
      db,
      userId,
      [prop.id],
      "2026-02-01",
    );
    expect(filteredResult.get(prop.id)).toBe(600000);
  });

  it("returns empty map when no property values exist", async () => {
    const prop = await insertProperty();

    const result = await getLatestPropertyValues(db, userId, [prop.id]);

    expect(result.size).toBe(0);
  });
});
