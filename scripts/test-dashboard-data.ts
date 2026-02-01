/**
 * Test dashboard data loading - checks if API calls return data
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.TEST_URL || "https://www.bricktrack.au";
const EMAIL = process.env.TEST_EMAIL || "demo@propertytracker.com.au";
const PASSWORD = process.env.TEST_PASSWORD || "Demo2026!";

interface ApiCall {
  url: string;
  method: string;
  status?: number;
  responseBody?: string;
  error?: string;
  timing?: number;
}

async function testDashboardData() {
  console.log(`🔍 Testing dashboard data loading on: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiCalls: ApiCall[] = [];
  const startTimes = new Map<string, number>();

  // Track API requests
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/") || url.includes("/trpc/")) {
      startTimes.set(url, Date.now());
      console.log(`📤 Request: ${request.method()} ${url.split("?")[0]}`);
    }
  });

  // Track API responses
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/") || url.includes("/trpc/")) {
      const startTime = startTimes.get(url) || Date.now();
      const timing = Date.now() - startTime;
      const status = response.status();

      const call: ApiCall = {
        url: url.split("?")[0],
        method: response.request().method(),
        status,
        timing,
      };

      // Capture response body for errors or trpc calls
      if (status >= 400 || url.includes("/trpc/")) {
        try {
          const body = await response.text();
          call.responseBody = body.slice(0, 1000);
        } catch {
          call.error = "Could not read response body";
        }
      }

      apiCalls.push(call);
      const statusIcon = status >= 400 ? "❌" : status >= 300 ? "⚠️" : "✅";
      console.log(`${statusIcon} Response: ${status} ${url.split("?")[0]} (${timing}ms)`);
    }
  });

  // Track failed requests
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/api/") || url.includes("/trpc/")) {
      const failure = request.failure();
      apiCalls.push({
        url: url.split("?")[0],
        method: request.method(),
        error: failure?.errorText || "Unknown error",
      });
      console.log(`❌ Request failed: ${url.split("?")[0]} - ${failure?.errorText}`);
    }
  });

  try {
    // Step 1: Sign in
    console.log("1️⃣ Signing in...");
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle", timeout: 60000 });

    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(EMAIL);

    const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
    await continueBtn.click();
    await page.waitForTimeout(2000);

    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(PASSWORD);

    const signInBtn = page.getByRole("button", { name: "Continue", exact: true });
    await signInBtn.click();

    // Step 2: Wait for dashboard
    console.log("\n2️⃣ Waiting for dashboard...");
    await page.waitForURL("**/dashboard", { timeout: 60000 });
    console.log("✅ Reached dashboard\n");

    // Step 3: Wait for data to load
    console.log("3️⃣ Waiting for data to load (30 seconds)...\n");
    await page.waitForTimeout(30000);

    // Step 4: Check if data loaded
    console.log("4️⃣ Checking dashboard content...");

    // Check for property count
    const propertyCard = page.locator('text=Investment properties tracked').first();
    const propertyValue = await propertyCard.locator('..').locator('.text-2xl, .text-3xl, .font-bold').first().textContent().catch(() => null);
    console.log(`   Properties value: ${propertyValue || "NOT FOUND"}`);

    // Check for any loading indicators still present
    const loadingCount = await page.locator('text=Loading').count();
    console.log(`   Loading indicators still visible: ${loadingCount}`);

    // Take screenshot
    await page.screenshot({ path: "/tmp/claude/dashboard-data-test.png", fullPage: true });
    console.log("   Screenshot saved to /tmp/claude/dashboard-data-test.png");

  } catch (error) {
    console.log(`\n❌ Error: ${error}`);
    await page.screenshot({ path: "/tmp/claude/dashboard-data-error.png" });
  }

  await browser.close();

  // Print API summary
  console.log("\n" + "=".repeat(70));
  console.log("📋 API CALLS SUMMARY");
  console.log("=".repeat(70));

  const trpcCalls = apiCalls.filter(c => c.url.includes("/trpc/"));
  const failedCalls = apiCalls.filter(c => c.status && c.status >= 400);
  const slowCalls = apiCalls.filter(c => c.timing && c.timing > 5000);

  if (trpcCalls.length === 0) {
    console.log("\n⚠️ NO tRPC CALLS MADE - This is the problem!");
  } else {
    console.log(`\n📊 tRPC calls made: ${trpcCalls.length}`);
    trpcCalls.forEach(c => {
      const statusIcon = c.status && c.status >= 400 ? "❌" : "✅";
      console.log(`   ${statusIcon} ${c.url} - ${c.status} (${c.timing}ms)`);
      if (c.responseBody && c.status && c.status >= 400) {
        console.log(`      Response: ${c.responseBody.slice(0, 200)}`);
      }
    });
  }

  if (failedCalls.length > 0) {
    console.log(`\n❌ FAILED API CALLS: ${failedCalls.length}`);
    failedCalls.forEach(c => {
      console.log(`   ${c.method} ${c.url} - ${c.status}`);
      if (c.responseBody) {
        console.log(`   Response: ${c.responseBody.slice(0, 300)}`);
      }
    });
  }

  if (slowCalls.length > 0) {
    console.log(`\n🐢 SLOW API CALLS (>5s): ${slowCalls.length}`);
    slowCalls.forEach(c => {
      console.log(`   ${c.url} - ${c.timing}ms`);
    });
  }

  console.log("\n" + "=".repeat(70));

  // Exit with error if no trpc calls or failures
  if (trpcCalls.length === 0 || failedCalls.length > 0) {
    console.log("\n❌ TEST FAILED - Dashboard data not loading properly");
    process.exit(1);
  } else {
    console.log("\n✅ TEST PASSED - API calls successful");
    process.exit(0);
  }
}

testDashboardData().catch((e) => {
  console.error("Test script failed:", e);
  process.exit(1);
});
