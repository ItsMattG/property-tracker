import type { SeedMode, SeedOptions, SeedSummary } from "./types";
import { generateDemoData } from "./profiles/demo";
import { generateDevData } from "./profiles/dev";
import { getOrCreateUser, cleanupUserData, insertDemoData, insertDevData } from "./db";

export { type SeedMode, type SeedOptions, type SeedSummary } from "./types";

// Re-export test fixtures for E2E tests
export {
  seedMinimalPortfolio,
  seedMultiPropertyPortfolio,
  seedCGTScenario,
  seedAnomalyScenario,
  seedComplianceScenario,
} from "./profiles/test";

/**
 * Main seed function - seeds data based on mode
 */
export async function seed(options: SeedOptions): Promise<SeedSummary> {
  const { clerkId, mode, clean = false } = options;

  console.log(`Starting seed in ${mode} mode for Clerk ID: ${clerkId}`);

  // Get or create user
  const userId = await getOrCreateUser(clerkId);
  console.log(`User ID: ${userId}`);

  // Clean existing data if requested
  if (clean) {
    console.log("Cleaning existing data...");
    await cleanupUserData(userId);
  }

  // Generate and insert data based on mode
  let summary: SeedSummary;

  if (mode === "demo") {
    console.log("Generating demo data (5-year realistic portfolio)...");
    const data = generateDemoData(userId);
    summary = await insertDemoData(data);
  } else if (mode === "dev") {
    console.log("Generating dev data (1-year fake data)...");
    const data = generateDevData(userId);
    summary = await insertDevData(data);
  } else {
    throw new Error(`Unknown seed mode: ${mode}. Use test fixtures directly for test mode.`);
  }

  console.log("Seed complete!");
  console.log("Summary:", summary);

  return summary;
}

/**
 * Clean up all seeded data for a user
 */
export async function clean(clerkId: string): Promise<void> {
  const userId = await getOrCreateUser(clerkId);
  await cleanupUserData(userId);
  console.log(`Cleaned all data for user: ${userId}`);
}
