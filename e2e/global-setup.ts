import { clerkSetup } from "@clerk/testing/playwright";
import { FullConfig } from "@playwright/test";
import { seedDemoDataForTests } from "./fixtures/seed-integration";

async function globalSetup(config: FullConfig) {
  await clerkSetup();

  const clerkId = process.env.E2E_CLERK_USER_ID;
  if (clerkId) {
    seedDemoDataForTests(clerkId);
  } else {
    console.warn("E2E_CLERK_USER_ID not set - tests may fail without seeded data");
  }
}

export default globalSetup;
