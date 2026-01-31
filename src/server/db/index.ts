import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false,
  max: 1, // Single connection for serverless environments
  idle_timeout: 20,
  connect_timeout: 30,
  ssl: 'require',
});

export const db = drizzle(client, { schema });
