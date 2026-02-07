import { testDb, schema } from "./db";
import { randomUUID } from "crypto";

// Test user constants
export const TEST_USER_EMAIL = "test_e2e@bricktrack.au";

// Will be set after seeding the test user
let testUserId: string | null = null;

/**
 * Get the test user's internal UUID.
 * Must call seedTestUser first.
 */
export function getTestUserId(): string {
  if (!testUserId) {
    throw new Error("Test user not seeded. Call seedTestUser() first.");
  }
  return testUserId;
}

/**
 * Seed a test user in the database.
 * This must be called before seeding any other test data.
 */
export async function seedTestUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
  const id = randomUUID();
  const user = {
    id,
    email: TEST_USER_EMAIL,
    name: "E2E Test User",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await testDb.insert(schema.users).values(user);
  testUserId = id;
  return user;
}

/**
 * Seed a test property in the database.
 * Requires seedTestUser to be called first.
 */
export async function seedTestProperty(overrides: Partial<typeof schema.properties.$inferInsert> = {}) {
  const userId = getTestUserId();
  const id = randomUUID();
  const property = {
    id,
    userId,
    address: "123 Test Street",
    suburb: "Sydney",
    state: "NSW" as const,
    postcode: "2000",
    purchasePrice: "500000.00",
    purchaseDate: "2024-01-15",
    entityName: "Personal",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await testDb.insert(schema.properties).values(property);
  return property;
}

/**
 * Seed a test bank account in the database.
 * Requires seedTestUser to be called first.
 */
export async function seedTestBankAccount(overrides: Partial<typeof schema.bankAccounts.$inferInsert> = {}) {
  const userId = getTestUserId();
  const id = randomUUID();
  const account = {
    id,
    userId,
    basiqConnectionId: `test_connection_${randomUUID().slice(0, 8)}`,
    basiqAccountId: `test_account_${randomUUID().slice(0, 8)}`,
    institution: "Test Bank",
    accountName: "Property Expenses",
    accountNumberMasked: "****1234",
    accountType: "transaction" as const,
    isConnected: true,
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };

  await testDb.insert(schema.bankAccounts).values(account);
  return account;
}

/**
 * Seed a test transaction in the database.
 * Requires a bank account ID (transactions must be linked to a bank account).
 */
export async function seedTestTransaction(
  bankAccountId: string,
  overrides: Partial<typeof schema.transactions.$inferInsert> = {}
) {
  const userId = getTestUserId();
  const id = randomUUID();
  const transaction = {
    id,
    userId,
    bankAccountId,
    basiqTransactionId: `test_txn_${randomUUID().slice(0, 8)}`,
    description: "Test Transaction",
    amount: "-150.00",
    date: new Date().toISOString().split("T")[0],
    category: "repairs_and_maintenance" as const,
    transactionType: "expense" as const,
    isDeductible: true,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await testDb.insert(schema.transactions).values(transaction);
  return transaction;
}

/**
 * Seed a complete test scenario with user, property, bank account, and transaction.
 * Useful for tests that need a fully populated environment.
 */
export async function seedCompleteTestScenario() {
  const user = await seedTestUser();
  const property = await seedTestProperty();
  const bankAccount = await seedTestBankAccount({ defaultPropertyId: property.id });
  const transaction = await seedTestTransaction(bankAccount.id, { propertyId: property.id });

  return {
    user,
    property,
    bankAccount,
    transaction,
  };
}

/**
 * Clean up all test data for the current test user.
 * Resets the test user ID so seedTestUser can be called again.
 */
export async function cleanupTestUser() {
  if (testUserId) {
    // Delete in order due to foreign keys
    const { transactions, bankAccounts, properties, users } = schema;
    const { eq } = await import("drizzle-orm");

    await testDb.delete(transactions).where(eq(transactions.userId, testUserId));
    await testDb.delete(bankAccounts).where(eq(bankAccounts.userId, testUserId));
    await testDb.delete(properties).where(eq(properties.userId, testUserId));
    await testDb.delete(users).where(eq(users.id, testUserId));

    testUserId = null;
  }
}

/**
 * Reset the test user ID without deleting data.
 * Useful when tests manage their own cleanup.
 */
export function resetTestUserId() {
  testUserId = null;
}
