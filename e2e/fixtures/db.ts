import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/server/db/schema";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;
// Use minimal connection pool to avoid MaxClientsInSessionMode errors
const client = postgres(connectionString, { max: 1, idle_timeout: 5 });
export const testDb = drizzle(client, { schema });

/**
 * Clean up all test data for a specific user ID.
 * Deletes in order due to foreign key constraints.
 */
export async function cleanupTestData(userId: string) {
  // Delete in order due to foreign keys:
  // transactions -> bankAccounts -> properties -> users
  await testDb.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
  await testDb.delete(schema.bankAccounts).where(eq(schema.bankAccounts.userId, userId));
  await testDb.delete(schema.properties).where(eq(schema.properties.userId, userId));
  await testDb.delete(schema.users).where(eq(schema.users.id, userId));
}

/**
 * Close the database connection.
 * Call this in afterAll hooks.
 */
export async function closeDbConnection() {
  await client.end();
}

export { schema };
