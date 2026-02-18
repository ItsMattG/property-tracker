// Shared drizzle-orm imports and custom types used by all domain schema files.
// Domain files import from here to avoid repeating drizzle-orm/pg-core imports.

export {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  date,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
  integer,
  varchar,
  customType,
  serial,
  real,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export { relations, sql } from "drizzle-orm";

import { customType } from "drizzle-orm/pg-core";

// Custom type for pgvector
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(5)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,0.3,0.4,0.5]" format
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => parseFloat(v));
  },
});
