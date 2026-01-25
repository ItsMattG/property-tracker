import { clerkSetup } from "@clerk/testing/playwright";
import { config } from "dotenv";
import { FullConfig } from "@playwright/test";
import { seedDemoDataForTests } from "./fixtures/seed-integration";

// Load environment variables
config({ path: ".env.local" });

// Get test user Clerk ID from environment
const E2E_CLERK_ID = process.env.E2E_CLERK_USER_ID;

async function globalSetup(config: FullConfig) {
  // Set up Clerk testing mode
  await clerkSetup();

  // Seed demo data if we have a test user configured
  if (E2E_CLERK_ID) {
    console.log("Seeding demo data for E2E tests...");
    try {
      await seedDemoDataForTests(E2E_CLERK_ID);
      console.log("Demo data seeded successfully");
    } catch (error) {
      console.error("Failed to seed demo data:", error);
      throw error;
    }
  } else {
    console.warn("E2E_CLERK_USER_ID not set - skipping demo data seeding");
  }
}

export default globalSetup;
