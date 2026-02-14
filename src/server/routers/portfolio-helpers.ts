import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { propertyValues } from "../db/schema";
import type { db as dbInstance } from "../db";

/** Fetch the latest property value per property using DISTINCT ON to avoid N+1 */
export async function getLatestPropertyValues(
  db: typeof dbInstance,
  userId: string,
  propertyIds: string[],
  beforeDate?: string
): Promise<Map<string, number>> {
  if (propertyIds.length === 0) return new Map();

  const conditions = [
    eq(propertyValues.userId, userId),
    inArray(propertyValues.propertyId, propertyIds),
  ];

  if (beforeDate) {
    conditions.push(lt(propertyValues.valueDate, beforeDate));
  }

  const rows = await db
    .selectDistinctOn([propertyValues.propertyId], {
      propertyId: propertyValues.propertyId,
      estimatedValue: propertyValues.estimatedValue,
    })
    .from(propertyValues)
    .where(and(...conditions))
    .orderBy(
      propertyValues.propertyId,
      desc(propertyValues.valueDate),
      desc(propertyValues.createdAt)
    );

  const latestValues = new Map<string, number>();
  for (const row of rows) {
    latestValues.set(row.propertyId, Number(row.estimatedValue));
  }
  return latestValues;
}
