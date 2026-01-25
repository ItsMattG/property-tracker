import { config } from "dotenv";

// Load env before importing db modules
config({ path: ".env.local" });

/**
 * Seeds demo data for E2E tests.
 * Uses dynamic import to ensure env vars are loaded first.
 */
export async function seedDemoDataForTests(clerkId: string): Promise<void> {
  const { seed, clean } = await import("../../src/lib/seed");

  // Clean existing data first for consistent state
  await clean(clerkId);

  // Seed fresh demo data
  await seed({
    clerkId,
    mode: "demo",
    clean: false, // Already cleaned above
  });
}

/**
 * Cleans up seeded data after tests.
 */
export async function cleanupSeedData(clerkId: string): Promise<void> {
  const { clean } = await import("../../src/lib/seed");
  await clean(clerkId);
}
