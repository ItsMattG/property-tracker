import { execSync } from "child_process";

/**
 * Seeds demo data for E2E tests by calling the seed script.
 * Only seeds if E2E_SEED_DATA env var is set to 'true'.
 * This avoids connection pool issues when dev server is running.
 *
 * To seed before tests, run manually:
 *   npm run seed:demo -- --email=<your_email> --clean
 */
export function seedDemoDataForTests(email: string): void {
  const shouldSeed = process.env.E2E_SEED_DATA === "true";

  if (!shouldSeed) {
    console.log("Skipping seed (E2E_SEED_DATA not set to 'true')");
    console.log("To seed data, run: npm run seed:demo -- --email=" + email + " --clean");
    return;
  }

  console.log("Running seed script...");
  execSync(`npx tsx src/scripts/seed.ts demo --email=${email} --clean`, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env },
  });
}

/**
 * Cleans up seeded data after tests.
 */
export function cleanupSeedData(email: string): void {
  execSync(`npx tsx src/scripts/seed.ts clean --email=${email} --force`, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env },
  });
}
