/**
 * Capture screenshots for README
 *
 * Run with: npx tsx scripts/capture-screenshots.ts
 *
 * Requires:
 * - E2E_DEMO_USER_EMAIL and E2E_DEMO_USER_PASSWORD as env vars
 * - PLAYWRIGHT_BASE_URL for production (e.g., https://bricktrack.au)
 */

import { chromium } from "@playwright/test";
import { config } from "dotenv";
import * as path from "path";
import * as fs from "fs";

config({ path: ".env.local" });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const DEMO_USER_EMAIL = process.env.E2E_DEMO_USER_EMAIL;
const DEMO_USER_PASSWORD = process.env.E2E_DEMO_USER_PASSWORD;
const SCREENSHOT_DIR = path.join(process.cwd(), "docs/screenshots");

async function main() {
  if (!DEMO_USER_EMAIL || !DEMO_USER_PASSWORD) {
    console.error("Error: E2E_DEMO_USER_EMAIL and E2E_DEMO_USER_PASSWORD must be set");
    process.exit(1);
  }

  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log(`Launching browser for ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Retina quality
  });
  const page = await context.newPage();

  try {
    // Sign in
    console.log("Signing in...");
    await page.goto(`${BASE_URL}/sign-in`);
    await page.getByLabel("Email").waitFor({ timeout: 30000 });

    await page.getByLabel("Email").fill(DEMO_USER_EMAIL);
    await page.getByLabel("Password").fill(DEMO_USER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 });

    console.log("Signed in successfully!");

    // Screenshot 1: Dashboard
    console.log("Capturing dashboard...");
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    // Wait for data to load
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard.png"),
      fullPage: false,
    });
    console.log("  Saved: dashboard.png");

    // Screenshot 2: Transactions
    console.log("Capturing transactions...");
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "transactions.png"),
      fullPage: false,
    });
    console.log("  Saved: transactions.png");

    // Screenshot 3: Tax Report
    console.log("Capturing tax report...");
    await page.goto(`${BASE_URL}/reports/tax`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "tax-report.png"),
      fullPage: false,
    });
    console.log("  Saved: tax-report.png");

    console.log("\nAll screenshots captured successfully!");
    console.log(`Location: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error("Error capturing screenshots:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
