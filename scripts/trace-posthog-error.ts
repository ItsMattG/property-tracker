/**
 * Deep trace of PostHog error - captures full stack trace and source files
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.TEST_URL || "https://www.bricktrack.au";
const EMAIL = process.env.TEST_EMAIL || "demo@propertytracker.com.au";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

async function tracePosthogError() {
  console.log(`🔍 Deep tracing PostHog error on: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allConsoleMessages: Array<{type: string, text: string, url?: string, lineNumber?: number}> = [];
  const allNetworkRequests: string[] = [];

  // Capture ALL console messages with details
  page.on("console", (msg) => {
    const location = msg.location();
    allConsoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      url: location?.url,
      lineNumber: location?.lineNumber,
    });

    // Log errors immediately with full details
    if (msg.type() === "error") {
      console.log(`\n❌ CONSOLE ERROR:`);
      console.log(`   Text: ${msg.text().slice(0, 500)}`);
      console.log(`   Source: ${location?.url}:${location?.lineNumber}:${location?.columnNumber}`);
    }
  });

  // Capture page errors with stack trace
  page.on("pageerror", (error) => {
    console.log(`\n💥 PAGE ERROR:`);
    console.log(`   Message: ${error.message}`);
    console.log(`   Stack: ${error.stack?.slice(0, 1000)}`);
  });

  // Track network requests to identify which chunks contain posthog
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/_next/") || url.includes("/chunks/") || url.includes("posthog") || url.includes("analytics") || url.includes("insights")) {
      allNetworkRequests.push(url);
    }
  });

  try {
    // Test landing page first
    console.log("📄 Testing landing page (unauthenticated)...");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(5000);

    // Now test sign-in
    console.log("\n📄 Testing sign-in page...");
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle", timeout: 60000 });

    // Enter email
    console.log("   Entering email...");
    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(EMAIL);

    const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
    await continueBtn.click();
    await page.waitForTimeout(2000);

    // Enter password
    console.log("   Entering password...");
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(PASSWORD);

    const signInBtn = page.getByRole("button", { name: "Continue", exact: true });
    await signInBtn.click();

    // Wait for dashboard
    console.log("   Waiting for dashboard...");
    await page.waitForURL("**/dashboard", { timeout: 60000 });
    console.log("✅ Reached dashboard!");

    // Wait longer for errors
    console.log("   Waiting 15 seconds for errors to surface...");
    await page.waitForTimeout(15000);

  } catch (error) {
    console.log(`\n⚠️ Error during test: ${error}`);
    await page.screenshot({ path: "/tmp/claude/trace-error.png" });
  }

  await browser.close();

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("📋 SUMMARY");
  console.log("=".repeat(70));

  const errors = allConsoleMessages.filter(m => m.type === "error");
  console.log(`\nTotal console errors: ${errors.length}`);

  console.log("\n📦 RELEVANT NETWORK REQUESTS:");
  const relevantUrls = allNetworkRequests.filter(url =>
    url.includes("posthog") ||
    url.includes("analytics") ||
    url.includes("insights") ||
    url.includes("speed")
  );
  if (relevantUrls.length === 0) {
    console.log("   No PostHog/Analytics requests found");
  } else {
    relevantUrls.forEach(url => console.log(`   ${url}`));
  }

  console.log("\n🔴 ALL ERRORS:");
  if (errors.length === 0) {
    console.log("   No errors found");
  } else {
    errors.forEach(e => {
      console.log(`\n   Error: ${e.text.slice(0, 200)}`);
      console.log(`   Source: ${e.url || "unknown"}`);
    });
  }

  // Exit with code based on whether posthog errors were found
  const posthogErrors = errors.filter(e =>
    e.text.toLowerCase().includes("detectstore") ||
    e.text.toLowerCase().includes("posthog")
  );

  if (posthogErrors.length > 0) {
    console.log("\n❌ PostHog errors detected");
    process.exit(1);
  } else {
    console.log("\n✅ No PostHog errors");
    process.exit(0);
  }
}

tracePosthogError().catch((e) => {
  console.error("Test script failed:", e);
  process.exit(1);
});
