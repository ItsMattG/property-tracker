/**
 * Automated test to check for console errors on production
 * Runs headless browser (no extensions) and captures JavaScript errors
 *
 * Usage:
 *   npm run test:console              # Test localhost:3000
 *   TEST_URL=https://www.bricktrack.au npm run test:console  # Test production
 *
 * Note: Browser extensions like Honey can cause PostHog errors that won't
 * appear in this test since it runs in a clean browser profile.
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "demo@propertytracker.com.au";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";
const RUN_AUTH_TEST = process.env.TEST_AUTH === "true";

interface ConsoleError {
  type: string;
  text: string;
  location?: string;
}

async function testConsoleErrors() {
  console.log(`🔍 Testing for console errors on: ${BASE_URL}`);
  console.log(`   Auth test: ${RUN_AUTH_TEST ? "enabled" : "disabled (set TEST_AUTH=true to enable)"}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: ConsoleError[] = [];
  const pageErrors: string[] = [];

  // Capture console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()?.url,
      });
    }
  });

  // Capture uncaught page errors
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    // Test 1: Landing page (public)
    console.log("📄 Testing landing page...");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Test 2: Sign-in page (public)
    console.log("📄 Testing sign-in page...");
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Test 3: Authenticated dashboard (optional)
    if (RUN_AUTH_TEST) {
      console.log("📄 Testing authenticated dashboard...");

      // Enter email
      const emailInput = page.locator('input[name="identifier"]');
      await emailInput.waitFor({ state: "visible", timeout: 10000 });
      await emailInput.fill(EMAIL);

      const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
      await continueBtn.click();
      await page.waitForTimeout(2000);

      // Enter password
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.waitFor({ state: "visible", timeout: 10000 });
      await passwordInput.fill(PASSWORD);

      const signInBtn = page.getByRole("button", { name: "Continue", exact: true });
      await signInBtn.click();

      // Wait for dashboard
      await page.waitForURL("**/dashboard", { timeout: 60000 });
      console.log("   ✅ Reached dashboard");
      await page.waitForTimeout(10000); // Wait for async errors
    } else {
      // Just try to visit dashboard (will redirect to sign-in)
      console.log("📄 Testing dashboard redirect...");
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);
    }

  } catch (error) {
    console.log(`⚠️ Navigation error: ${error}`);
  }

  await browser.close();

  // Report results
  console.log("\n" + "=".repeat(60));
  console.log("📋 RESULTS");
  console.log("=".repeat(60));

  // Filter out known non-critical errors
  const isKnownNonCritical = (text: string) =>
    text.includes("/_vercel/insights") || // Vercel Analytics not enabled yet
    text.includes("/_vercel/speed-insights") || // Speed Insights not enabled yet
    text.includes("401") || // Auth redirects
    text.includes("403"); // Protected routes

  const criticalErrors = consoleErrors.filter(
    (e) =>
      !isKnownNonCritical(e.text) &&
      (e.text.includes("TypeError") ||
        e.text.includes("ReferenceError") ||
        e.text.includes("Uncaught") ||
        e.text.includes("SyntaxError"))
  );

  const warningErrors = consoleErrors.filter(
    (e) =>
      e.text.includes("Failed to load") ||
      e.text.includes("404")
  );

  if (pageErrors.length > 0) {
    console.log("\n❌ PAGE ERRORS (critical - breaks React):");
    pageErrors.forEach((e) => console.log(`   - ${e}`));
  }

  if (criticalErrors.length > 0) {
    console.log("\n❌ CRITICAL CONSOLE ERRORS:");
    criticalErrors.forEach((e) => console.log(`   - ${e.text.slice(0, 300)}`));
  }

  if (warningErrors.length > 0) {
    console.log("\n⚠️ WARNINGS (non-critical):");
    warningErrors.forEach((e) => console.log(`   - ${e.text.slice(0, 200)}`));
  }

  if (pageErrors.length === 0 && criticalErrors.length === 0) {
    console.log("\n✅ No critical errors found!");
  }

  console.log("\n" + "=".repeat(60));

  // Exit with error code if critical errors found
  const hasErrors = pageErrors.length > 0 || criticalErrors.length > 0;
  if (hasErrors) {
    console.log("\n❌ TEST FAILED - Critical errors detected");
    process.exit(1);
  } else {
    console.log("\n✅ TEST PASSED - No critical errors");
    process.exit(0);
  }
}

testConsoleErrors().catch((e) => {
  console.error("Test script failed:", e);
  process.exit(1);
});
