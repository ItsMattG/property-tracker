/**
 * Debug dashboard loading issues by monitoring network and console
 */

import { chromium, type Page, type Request, type Response } from "@playwright/test";

const BASE_URL = "https://www.bricktrack.au";
const EMAIL = "demo@propertytracker.com.au";
const PASSWORD = "Demo2026!";

interface NetworkLog {
  url: string;
  method: string;
  status?: number;
  timing?: number;
  error?: string;
  response?: string;
}

async function debugDashboard() {
  console.log("🔍 Starting dashboard debug session...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkLogs: NetworkLog[] = [];
  const consoleLogs: string[] = [];

  // Capture console messages
  page.on("console", (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === "error") {
      console.log(`❌ Console error: ${msg.text()}`);
    }
  });

  // Capture page errors
  page.on("pageerror", (error) => {
    console.log(`❌ Page error: ${error.message}`);
    consoleLogs.push(`[pageerror] ${error.message}`);
  });

  // Track requests
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/")) {
      console.log(`📤 Request: ${request.method()} ${url.split("?")[0]}`);
    }
  });

  // Track responses
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/")) {
      const status = response.status();
      const log: NetworkLog = {
        url: url.split("?")[0],
        method: response.request().method(),
        status,
      };

      if (status >= 400 || url.includes("/api/trpc")) {
        try {
          const body = await response.text();
          log.response = body.slice(0, 500);
        } catch (e) {
          log.error = "Could not read response body";
        }
      }

      networkLogs.push(log);
      console.log(`📥 Response: ${status} ${url.split("?")[0]}`);
    }
  });

  // Track failed requests
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/api/")) {
      const failure = request.failure();
      console.log(`❌ Request failed: ${url.split("?")[0]} - ${failure?.errorText}`);
      networkLogs.push({
        url: url.split("?")[0],
        method: request.method(),
        error: failure?.errorText || "Unknown error",
      });
    }
  });

  try {
    // Step 1: Go to sign-in
    console.log("\n1️⃣ Navigating to sign-in page...");
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle", timeout: 60000 });
    await page.screenshot({ path: "/tmp/claude/debug-1-signin.png" });

    // Step 2: Enter email
    console.log("2️⃣ Entering email...");
    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(EMAIL);
    await page.screenshot({ path: "/tmp/claude/debug-2-email.png" });

    // Click continue (the form submit button, not Google)
    const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
    await continueBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "/tmp/claude/debug-3-after-email.png" });

    // Step 3: Enter password
    console.log("3️⃣ Entering password...");
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(PASSWORD);
    await page.screenshot({ path: "/tmp/claude/debug-4-password.png" });

    // Click continue to sign in
    const signInBtn = page.getByRole('button', { name: 'Continue', exact: true });
    await signInBtn.click();

    // Wait for navigation/response
    console.log("   Waiting for response after password submit...");
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "/tmp/claude/debug-4b-after-submit.png" });
    console.log(`   Current URL: ${page.url()}`);

    // Step 4: Wait for dashboard (with longer timeout and check for errors)
    console.log("4️⃣ Waiting for dashboard redirect...");
    try {
      await page.waitForURL("**/dashboard", { timeout: 30000 });
    } catch {
      // Check if there's an error message
      const errorText = await page.locator('.cl-formFieldError, [data-error], .error').textContent().catch(() => null);
      console.log(`   Error on page: ${errorText || "none visible"}`);
      console.log(`   Final URL: ${page.url()}`);
      await page.screenshot({ path: "/tmp/claude/debug-login-failed.png" });
      throw new Error("Login failed - did not redirect to dashboard");
    }
    console.log("✅ Reached dashboard!");
    await page.screenshot({ path: "/tmp/claude/debug-5-dashboard-initial.png" });

    // Step 5: Wait for data to load
    console.log("5️⃣ Waiting for data to load (30 seconds)...");
    await page.waitForTimeout(30000);
    await page.screenshot({ path: "/tmp/claude/debug-6-dashboard-after-wait.png", fullPage: true });

    // Check if stats loaded
    const statsText = await page.locator('[data-testid="property-count"], .text-3xl, .text-2xl').first().textContent().catch(() => null);
    console.log(`\n📊 Stats text found: ${statsText || "None"}`);

  } catch (error) {
    console.log(`\n❌ Error during test: ${error}`);
    await page.screenshot({ path: "/tmp/claude/debug-error.png" });
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 NETWORK SUMMARY (API calls):");
  console.log("=".repeat(60));

  for (const log of networkLogs) {
    const statusIcon = log.error ? "❌" : (log.status && log.status >= 400) ? "⚠️" : "✅";
    console.log(`${statusIcon} ${log.method} ${log.url}`);
    if (log.status) console.log(`   Status: ${log.status}`);
    if (log.error) console.log(`   Error: ${log.error}`);
    if (log.response) {
      console.log(`   Response: ${log.response.slice(0, 200)}...`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 CONSOLE ERRORS:");
  console.log("=".repeat(60));
  const errors = consoleLogs.filter(l => l.includes("[error]") || l.includes("[pageerror]"));
  if (errors.length === 0) {
    console.log("No console errors found");
  } else {
    errors.forEach(e => console.log(e));
  }

  await browser.close();
  console.log("\n✅ Debug session complete. Screenshots saved to /tmp/claude/");
}

debugDashboard().catch(console.error);
