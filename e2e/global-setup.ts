import { clerkSetup } from "@clerk/testing/playwright";
import { FullConfig } from "@playwright/test";
import { seedDemoDataForTests } from "./fixtures/seed-integration";

async function globalSetup(config: FullConfig) {
  // Only run Clerk setup if the env var is present
  // This allows running public page tests without Clerk credentials
  if (process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    await clerkSetup();
  } else {
    console.warn("CLERK_PUBLISHABLE_KEY not set - skipping Clerk setup. Auth tests will be skipped.");
  }

  const clerkId = process.env.E2E_CLERK_USER_ID;
  if (clerkId) {
    seedDemoDataForTests(clerkId);
  } else {
    console.warn("E2E_CLERK_USER_ID not set - tests may fail without seeded data");
  }
}

export default globalSetup;
