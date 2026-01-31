import { testDb, schema } from "./db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Decoy user that should never be accessible by the test user
let decoyUserId: string | null = null;
let decoyPropertyId: string | null = null;
let decoyTransactionId: string | null = null;

// Retry helper for database operations (handles pool exhaustion)
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isPoolError = (error as Error).message?.includes("MaxClientsInSessionMode");
      if (isPoolError && i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Retry exhausted");
}

export function getDecoyIds() {
  if (!decoyUserId || !decoyPropertyId) {
    throw new Error("Decoy data not seeded. Call seedDecoyData() first.");
  }
  return {
    userId: decoyUserId,
    propertyId: decoyPropertyId,
    transactionId: decoyTransactionId,
  };
}

/**
 * Seed a complete decoy user scenario.
 * This data should NEVER be accessible by the real test user.
 */
export async function seedDecoyData() {
  return withRetry(async () => {
    // Create decoy user
    decoyUserId = randomUUID();
    await testDb.insert(schema.users).values({
      id: decoyUserId,
      clerkId: `decoy_clerk_${Date.now()}`,
      email: `decoy-${Date.now()}@test.com`,
      name: "Decoy User",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create decoy property
    decoyPropertyId = randomUUID();
    await testDb.insert(schema.properties).values({
      id: decoyPropertyId,
      userId: decoyUserId,
      address: "999 Decoy Street",
      suburb: "Decoyville",
      state: "NSW",
      postcode: "9999",
      purchasePrice: "999999.00",
      purchaseDate: "2020-01-01",
      entityName: "Decoy Entity",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create decoy transaction (no bank account needed for manual tx)
    decoyTransactionId = randomUUID();
    await testDb.insert(schema.transactions).values({
      id: decoyTransactionId,
      userId: decoyUserId,
      propertyId: decoyPropertyId,
      description: "Decoy Transaction - SHOULD NOT BE VISIBLE",
      amount: "-99999.00",
      date: "2020-01-01",
      category: "uncategorized",
      transactionType: "expense",
      isDeductible: false,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return getDecoyIds();
  });
}

/**
 * Clean up decoy data after tests.
 */
export async function cleanupDecoyData() {
  if (decoyUserId) {
    const userId = decoyUserId;
    await withRetry(async () => {
      await testDb.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
      await testDb.delete(schema.properties).where(eq(schema.properties.userId, userId));
      await testDb.delete(schema.users).where(eq(schema.users.id, userId));
    });

    decoyUserId = null;
    decoyPropertyId = null;
    decoyTransactionId = null;
  }
}
