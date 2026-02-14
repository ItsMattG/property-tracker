import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema";

/** Database client type — works for both main db and transaction tx */
export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Base repository — provides shared infrastructure for all repositories.
 * Subclasses access this.db for queries and this.resolve(tx) for
 * transaction-aware write operations.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: DB) {}

  /** Use the provided transaction or fall back to the default db client */
  protected resolve(tx?: DB): DB {
    return tx ?? this.db;
  }
}
