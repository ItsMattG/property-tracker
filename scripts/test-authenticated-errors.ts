/**
 * Test for console errors when authenticated
 * This simulates a logged-in user to trigger PostHog initialization
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.TEST_URL || "https://www.bricktrack.au";
const EMAIL = process.env.TEST_EMAIL || "demo@propertytracker.com.au";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

interface ConsoleError {
  type: string;
  text: string;
  location?: string;
}

async function testAuthenticatedErrors() {
  console.log(`🔍 Testing for console errors (authenticated) on: ${BASE_URL}\n`);

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
    // Step 1: Go to sign-in
    console.log("1️⃣ Navigating to sign-in page...");
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle", timeout: 60000 });

    // Step 2: Enter email
    console.log("2️⃣ Entering email...");
    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(EMAIL);

    // Click continue
    const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
    await continueBtn.click();
    await page.waitForTimeout(2000);

    // Step 3: Enter password
    console.log("3️⃣ Entering password...");
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(PASSWORD);

    // Click continue to sign in
    const signInBtn = page.getByRole("button", { name: "Continue", exact: true });
    await signInBtn.click();

    // Step 4: Wait for dashboard
    console.log("4️⃣ Waiting for dashboard redirect...");
    await page.waitForURL("**/dashboard", { timeout: 60000 });
    console.log("✅ Reached dashboard!");

    // Step 5: Wait for everything to load and errors to surface
    console.log("5️⃣ Waiting for async errors to surface (10 seconds)...");
    await page.waitForTimeout(10000);

  } catch (error) {
    console.log(`⚠️ Navigation/Auth error: ${error}`);
    await page.screenshot({ path: "/tmp/claude/test-error.png" });
  }

  await browser.close();

  // Report results
  console.log("\n" + "=".repeat(60));
  console.log("📋 RESULTS");
  console.log("=".repeat(60));

  const posthogErrors = consoleErrors.filter(
    (e) =>
      e.text.includes("detectStore") ||
      e.text.includes("posthog")
  );

  const criticalErrors = consoleErrors.filter(
    (e) =>
      e.text.includes("TypeError") ||
      e.text.includes("ReferenceError") ||
      e.text.includes("Uncaught")
  );

  const loadFailures = consoleErrors.filter(
    (e) =>
      e.text.includes("Failed to load") ||
      e.text.includes("404")
  );

  if (pageErrors.length > 0) {
    console.log("\n❌ PAGE ERRORS (critical - breaks React):");
    pageErrors.forEach((e) => console.log(`   - ${e}`));
  }

  if (posthogErrors.length > 0) {
    console.log("\n❌ POSTHOG ERRORS:");
    posthogErrors.forEach((e) => console.log(`   - ${e.text.slice(0, 300)}`));
  }

  if (criticalErrors.length > 0) {
    console.log("\n❌ CRITICAL CONSOLE ERRORS:");
    criticalErrors.forEach((e) => console.log(`   - ${e.text.slice(0, 300)}`));
  }

  if (loadFailures.length > 0) {
    console.log("\n⚠️ LOAD FAILURES (404s):");
    loadFailures.forEach((e) => console.log(`   - ${e.text.slice(0, 200)}`));
  }

  if (pageErrors.length === 0 && posthogErrors.length === 0 && criticalErrors.length === 0) {
    console.log("\n✅ No critical errors found!");
  }

  console.log("\n" + "=".repeat(60));

  // Exit with error code if critical errors found
  const hasErrors = pageErrors.length > 0 || posthogErrors.length > 0 || criticalErrors.length > 0;
  if (hasErrors) {
    console.log("\n❌ TEST FAILED - Critical errors detected");
    process.exit(1);
  } else {
    console.log("\n✅ TEST PASSED - No critical errors");
    process.exit(0);
  }
}

testAuthenticatedErrors().catch((e) => {
  console.error("Test script failed:", e);
  process.exit(1);
});
