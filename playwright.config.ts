import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: ".env.local" });

const authFile = path.join(__dirname, "e2e", ".auth", "user.json");

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  testMatch: ["**/*.spec.ts", "**/*.audit.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Auth setup — logs in once, saves session for reuse
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Public pages — no auth needed
    {
      name: "public",
      testMatch: [
        "landing.spec.ts",
        "blog.spec.ts",
        "changelog.spec.ts",
        "auth.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    // Authenticated tests — session pre-loaded via storageState
    {
      name: "authenticated",
      testIgnore: [
        /core-loop\.spec\.ts/,
        /landing\.spec\.ts/,
        /blog\.spec\.ts/,
        /changelog\.spec\.ts/,
        /auth\.spec\.ts/,
        /auth\.setup\.ts/,
      ],
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
    // Core loop — extended timeout, serial execution
    {
      name: "core-loop",
      testMatch: "core-loop.spec.ts",
      timeout: 300_000,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        actionTimeout: 15_000,
        storageState: authFile,
      },
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
