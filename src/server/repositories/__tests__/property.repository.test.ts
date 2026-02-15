import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { properties, equityMilestones, users } from "../../db/schema";
import { PropertyRepository } from "../property.repository";
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

const TEST_USER_ID = "test-property-repo-user";
const OTHER_USER_ID = "test-property-repo-other";

describe.skipIf(!hasDatabase)("PropertyRepository", () => {
  let repo: PropertyRepository;

  beforeAll(async () => {
    repo = new PropertyRepository(db);

    // Ensure test users exist (users table requires these)
    await (db as any)
      .insert(users)
      .values([
        {
          id: TEST_USER_ID,
          email: "prop-repo-test@example.com",
          name: "Prop Repo Test",
          emailVerified: true,
        },
        {
          id: OTHER_USER_ID,
          email: "prop-repo-other@example.com",
          name: "Other User",
          emailVerified: true,
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Clean up: delete test properties, milestones, then users
    await (db as any).delete(equityMilestones).where(
      eq(equityMilestones.userId, TEST_USER_ID)
    );
    await (db as any).delete(properties).where(
      eq(properties.userId, TEST_USER_ID)
    );
    await (db as any).delete(properties).where(
      eq(properties.userId, OTHER_USER_ID)
    );
    await (db as any).delete(users).where(eq(users.id, TEST_USER_ID));
    await (db as any).delete(users).where(eq(users.id, OTHER_USER_ID));
    await client.end();
  });

  beforeEach(async () => {
    // Clean slate: remove all test properties before each test
    await (db as any).delete(equityMilestones).where(
      eq(equityMilestones.userId, TEST_USER_ID)
    );
    await (db as any).delete(properties).where(
      eq(properties.userId, TEST_USER_ID)
    );
    await (db as any).delete(properties).where(
      eq(properties.userId, OTHER_USER_ID)
    );
  });

  async function insertProperty(
    overrides: Partial<schema.NewProperty> = {}
  ): Promise<schema.Property> {
    const [prop] = await (db as any)
      .insert(properties)
      .values({
        userId: TEST_USER_ID,
        address: "123 Test St",
        suburb: "Testville",
        state: "NSW",
        postcode: "2000",
        purchasePrice: "500000",
        purchaseDate: "2024-01-01",
        entityName: "Personal",
        ...overrides,
      })
      .returning();
    return prop;
  }

  describe("findByOwner", () => {
    it("returns all properties for a user", async () => {
      await insertProperty({ address: "1 Alpha St" });
      await insertProperty({ address: "2 Beta St" });

      const result = await repo.findByOwner(TEST_USER_ID);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.address)).toEqual(
        expect.arrayContaining(["1 Alpha St", "2 Beta St"])
      );
    });

    it("does not return properties from other users", async () => {
      await insertProperty({ address: "My Property" });
      await insertProperty({
        userId: OTHER_USER_ID,
        address: "Not Mine",
      });

      const result = await repo.findByOwner(TEST_USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("My Property");
    });

    it("returns properties ordered by createdAt descending", async () => {
      const p1 = await insertProperty({ address: "First" });
      const p2 = await insertProperty({ address: "Second" });

      const result = await repo.findByOwner(TEST_USER_ID);

      // Most recent first
      expect(result[0].id).toBe(p2.id);
      expect(result[1].id).toBe(p1.id);
    });

    it("excludes locked properties when excludeLocked is true", async () => {
      await insertProperty({ address: "Unlocked", locked: false });
      await insertProperty({ address: "Locked", locked: true });

      const result = await repo.findByOwner(TEST_USER_ID, {
        excludeLocked: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("Unlocked");
    });

    it("includes locked properties when excludeLocked is false", async () => {
      await insertProperty({ address: "Unlocked", locked: false });
      await insertProperty({ address: "Locked", locked: true });

      const result = await repo.findByOwner(TEST_USER_ID, {
        excludeLocked: false,
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("returns a property by id scoped to user", async () => {
      const prop = await insertProperty({ address: "Find Me" });

      const result = await repo.findById(prop.id, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(prop.id);
      expect(result!.address).toBe("Find Me");
    });

    it("returns null for non-existent property", async () => {
      const result = await repo.findById(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID
      );

      expect(result).toBeNull();
    });

    it("returns null when property belongs to another user", async () => {
      const prop = await insertProperty({
        userId: OTHER_USER_ID,
        address: "Not Mine",
      });

      const result = await repo.findById(prop.id, TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("inserts and returns a new property", async () => {
      const result = await repo.create({
        userId: TEST_USER_ID,
        address: "New Property",
        suburb: "Newtown",
        state: "VIC",
        postcode: "3000",
        purchasePrice: "750000",
        purchaseDate: "2025-01-01",
        entityName: "Trust",
      });

      expect(result.id).toBeDefined();
      expect(result.address).toBe("New Property");
      expect(result.suburb).toBe("Newtown");
      expect(result.state).toBe("VIC");
      expect(result.userId).toBe(TEST_USER_ID);
    });
  });

  describe("update", () => {
    it("modifies and returns the updated property", async () => {
      const prop = await insertProperty({ address: "Old Address" });

      const result = await repo.update(prop.id, TEST_USER_ID, {
        address: "New Address",
        suburb: "Updated Suburb",
      });

      expect(result).not.toBeNull();
      expect(result!.address).toBe("New Address");
      expect(result!.suburb).toBe("Updated Suburb");
    });

    it("returns null when updating non-existent property", async () => {
      const result = await repo.update(
        "00000000-0000-0000-0000-000000000000",
        TEST_USER_ID,
        { address: "Ghost" }
      );

      expect(result).toBeNull();
    });

    it("returns null when updating property of another user", async () => {
      const prop = await insertProperty({
        userId: OTHER_USER_ID,
        address: "Not Mine",
      });

      const result = await repo.update(prop.id, TEST_USER_ID, {
        address: "Hijacked",
      });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the property", async () => {
      const prop = await insertProperty({ address: "Delete Me" });

      await repo.delete(prop.id, TEST_USER_ID);

      const result = await repo.findById(prop.id, TEST_USER_ID);
      expect(result).toBeNull();
    });

    it("does not delete another user's property", async () => {
      const prop = await insertProperty({
        userId: OTHER_USER_ID,
        address: "Protected",
      });

      await repo.delete(prop.id, TEST_USER_ID);

      // Property should still exist for other user
      const result = await (db as any).query.properties.findFirst({
        where: eq(properties.id, prop.id),
      });
      expect(result).not.toBeNull();
    });
  });

  describe("countByOwner", () => {
    it("returns the correct count", async () => {
      await insertProperty({ address: "A" });
      await insertProperty({ address: "B" });
      await insertProperty({ address: "C" });

      const count = await repo.countByOwner(TEST_USER_ID);

      expect(count).toBe(3);
    });

    it("returns 0 for user with no properties", async () => {
      const count = await repo.countByOwner(TEST_USER_ID);

      expect(count).toBe(0);
    });
  });

  describe("findMilestones", () => {
    it("returns milestones for a property ordered by achievedAt desc", async () => {
      const prop = await insertProperty({ address: "Milestone Prop" });

      await (db as any).insert(equityMilestones).values([
        {
          propertyId: prop.id,
          userId: TEST_USER_ID,
          milestoneType: "lvr",
          milestoneValue: "80",
          equityAtAchievement: "100000",
          lvrAtAchievement: "79.50",
          achievedAt: new Date("2024-01-01"),
        },
        {
          propertyId: prop.id,
          userId: TEST_USER_ID,
          milestoneType: "lvr",
          milestoneValue: "60",
          equityAtAchievement: "200000",
          lvrAtAchievement: "59.50",
          achievedAt: new Date("2025-01-01"),
        },
      ]);

      const result = await repo.findMilestones(prop.id, TEST_USER_ID);

      expect(result).toHaveLength(2);
      // Most recent first
      expect(result[0].milestoneValue).toBe("60.00");
      expect(result[1].milestoneValue).toBe("80.00");
    });
  });
});
