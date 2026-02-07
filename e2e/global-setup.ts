import { FullConfig } from "@playwright/test";
import { seedDemoDataForTests } from "./fixtures/seed-integration";

async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_USER_EMAIL;
  if (email) {
    seedDemoDataForTests(email);
  } else {
    console.warn("E2E_USER_EMAIL not set - tests may fail without seeded data");
  }
}

export default globalSetup;
