import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: ".env.local" });

const authFile = path.join(__dirname, "e2e", ".auth", "user.json");

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Staging cold starts can be slow — 120s gives safeGoto retries + test assertions room
  timeout: process.env.CI ? 120_000 : 30_000,
  // Use blob reporter in CI for shard merging, HTML locally
  reporter: process.env.CI ? "blob" : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Auth setup — runs once, saves storageState for authenticated projects
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // Public pages — no auth needed, runs in parallel with authenticated
    {
      name: "public",
      testDir: "./e2e/public",
      testMatch: "**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    // Authenticated pages — depends on setup, uses saved session
    {
      name: "authenticated",
      testDir: "./e2e/authenticated",
      testMatch: "**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      dependencies: ["setup"],
    },

    // Core loop — long-running bank-connect flow, extended timeout
    {
      name: "core-loop",
      testDir: "./e2e/core-loop",
      testMatch: "**/*.spec.ts",
      timeout: 300_000,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
        actionTimeout: 15_000,
      },
      dependencies: ["setup"],
    },
  ],
  // Only start local server if not testing against a preview URL
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
      },
});
