import { clerkSetup } from "@clerk/testing/playwright";
import { config } from "dotenv";
import { FullConfig } from "@playwright/test";

// Load environment variables
config({ path: ".env.local" });

async function globalSetup(config: FullConfig) {
  await clerkSetup();
}

export default globalSetup;
