import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { DemoData } from "./profiles/demo";
import type { DevData } from "./profiles/dev";
import type { SeedSummary } from "./types";

/**
 * Get or create user by Clerk ID
 */
export async function getOrCreateUser(clerkId: string): Promise<string> {
  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkId),
  });

  if (existingUser) {
    return existingUser.id;
  }

  // Create user
  const [newUser] = await db
    .insert(schema.users)
    .values({
      clerkId,
      email: `seed-${clerkId}@propertytracker.local`,
      name: "Seeded User",
    })
    .returning();

  return newUser.id;
}

/**
 * Clean up all data for a user (respects foreign key order)
 */
export async function cleanupUserData(userId: string): Promise<void> {
  // Delete in reverse dependency order
  await db.delete(schema.anomalyAlerts).where(eq(schema.anomalyAlerts.userId, userId));
  await db.delete(schema.connectionAlerts).where(eq(schema.connectionAlerts.userId, userId));
  await db.delete(schema.complianceRecords).where(eq(schema.complianceRecords.userId, userId));

  // Get loans for this user to delete their refinance alerts
  const userLoans = await db.query.loans.findMany({
    where: eq(schema.loans.userId, userId),
    columns: { id: true },
  });

  for (const loan of userLoans) {
    await db.delete(schema.refinanceAlerts).where(eq(schema.refinanceAlerts.loanId, loan.id));
  }

  await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
  await db.delete(schema.loans).where(eq(schema.loans.userId, userId));
  await db.delete(schema.propertySales).where(eq(schema.propertySales.userId, userId));
  await db.delete(schema.bankAccounts).where(eq(schema.bankAccounts.userId, userId));
  await db.delete(schema.properties).where(eq(schema.properties.userId, userId));
  await db.delete(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, userId));
  await db.delete(schema.userOnboarding).where(eq(schema.userOnboarding.userId, userId));
}

/**
 * Insert demo data into database
 */
export async function insertDemoData(data: DemoData): Promise<SeedSummary> {
  // Insert in dependency order
  await db.insert(schema.properties).values(data.properties);
  await db.insert(schema.bankAccounts).values(data.bankAccounts);
  await db.insert(schema.loans).values(data.loans);

  if (data.propertySales.length > 0) {
    await db.insert(schema.propertySales).values(data.propertySales);
  }

  // Insert transactions in batches to avoid query size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < data.transactions.length; i += BATCH_SIZE) {
    const batch = data.transactions.slice(i, i + BATCH_SIZE);
    await db.insert(schema.transactions).values(batch);
  }

  if (data.refinanceAlerts.length > 0) {
    await db.insert(schema.refinanceAlerts).values(data.refinanceAlerts);
  }

  if (data.anomalyAlerts.length > 0) {
    await db.insert(schema.anomalyAlerts).values(data.anomalyAlerts);
  }

  if (data.complianceRecords.length > 0) {
    await db.insert(schema.complianceRecords).values(data.complianceRecords);
  }

  return {
    users: 1,
    properties: data.properties.length,
    bankAccounts: data.bankAccounts.length,
    transactions: data.transactions.length,
    loans: data.loans.length,
    alerts: data.anomalyAlerts.length + (data.refinanceAlerts?.length ?? 0),
    complianceRecords: data.complianceRecords.length,
  };
}

/**
 * Insert dev data into database
 */
export async function insertDevData(data: DevData): Promise<SeedSummary> {
  await db.insert(schema.properties).values(data.properties);
  await db.insert(schema.bankAccounts).values(data.bankAccounts);
  await db.insert(schema.loans).values(data.loans);

  const BATCH_SIZE = 100;
  for (let i = 0; i < data.transactions.length; i += BATCH_SIZE) {
    const batch = data.transactions.slice(i, i + BATCH_SIZE);
    await db.insert(schema.transactions).values(batch);
  }

  if (data.anomalyAlerts.length > 0) {
    await db.insert(schema.anomalyAlerts).values(data.anomalyAlerts);
  }

  if (data.connectionAlerts.length > 0) {
    await db.insert(schema.connectionAlerts).values(data.connectionAlerts);
  }

  if (data.complianceRecords.length > 0) {
    await db.insert(schema.complianceRecords).values(data.complianceRecords);
  }

  return {
    users: 1,
    properties: data.properties.length,
    bankAccounts: data.bankAccounts.length,
    transactions: data.transactions.length,
    loans: data.loans.length,
    alerts: data.anomalyAlerts.length + data.connectionAlerts.length,
    complianceRecords: data.complianceRecords.length,
  };
}
