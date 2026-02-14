import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../db/schema";

export function createIntegrationDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL required for integration tests");
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 10,
  });

  const db = drizzle(client, { schema });
  return { db, sql: client };
}

export function testUserId() {
  return `test-integration-${crypto.randomUUID()}`;
}
