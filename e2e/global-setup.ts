import { clerkSetup } from "@clerk/testing/playwright";
import { config } from "dotenv";
import { FullConfig } from "@playwright/test";
import { seedDemoDataForTests } from "./fixtures/seed-integration";

// Load environment variables
config({ path: ".env.local" });

// Get test user Clerk ID from environment
const E2E_CLERK_ID = process.env.E2E_CLERK_USER_ID;

async function globalSetup(config: FullConfig) {
  // Set up Clerk testing mode (graceful failure)
  try {
    await clerkSetup();
    console.log("Clerk testing mode enabled");
  } catch (error) {
    console.warn("Clerk testing setup failed - tests will use normal auth flow");
    console.warn("Enable testing mode in Clerk Dashboard > Configure > Testing");
  }

  // Optionally seed demo data (controlled by E2E_SEED_DATA env var)
  if (E2E_CLERK_ID) {
    seedDemoDataForTests(E2E_CLERK_ID);
  } else {
    console.warn("E2E_CLERK_USER_ID not set - tests may fail without seeded data");
  }
}

export default globalSetup;
