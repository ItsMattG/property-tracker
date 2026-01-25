import { execSync } from "child_process";

/**
 * Seeds demo data for E2E tests by calling the seed script.
 * Uses subprocess to avoid ESM/CJS module issues.
 */
export async function seedDemoDataForTests(clerkId: string): Promise<void> {
  // Clean existing data first, then seed fresh demo data
  execSync(`npx tsx src/scripts/seed.ts demo --clerk-id=${clerkId} --clean`, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env },
  });
}

/**
 * Cleans up seeded data after tests.
 */
export async function cleanupSeedData(clerkId: string): Promise<void> {
  execSync(`npx tsx src/scripts/seed.ts clean --clerk-id=${clerkId} --force`, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env },
  });
}
