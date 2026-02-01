import { chromium } from "@playwright/test";

async function test() {
  console.log("Starting authenticated test...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for failed requests
  page.on('requestfailed', request => {
    console.log("Request failed:", request.url());
    console.log("  Failure:", request.failure()?.errorText);
  });

  // Listen for responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/trpc') || url.includes('/api/health')) {
      const status = response.status();
      console.log(status, url.split('?')[0]);
      if (status >= 400) {
        try {
          const body = await response.text();
          console.log("  Body:", body.slice(0, 200));
        } catch (e) {}
      }
    }
  });

  // Go to sign-in
  console.log("1. Going to sign-in page...");
  await page.goto("https://www.bricktrack.au/sign-in", { timeout: 60000 });
  await page.waitForLoadState("networkidle");

  // Fill credentials
  console.log("2. Filling credentials...");
  await page.fill('input[name="identifier"]', 'demo@propertytracker.com.au');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(2000);

  await page.fill('input[name="password"]', 'Demo2026!');
  await page.click('button:has-text("Continue")');

  // Wait for dashboard
  console.log("3. Waiting for dashboard...");
  await page.waitForURL('**/dashboard', { timeout: 60000 });
  console.log("4. On dashboard, waiting for data...");

  // Wait a bit for tRPC requests
  await page.waitForTimeout(15000);

  console.log("\n5. Taking screenshot...");
  await page.screenshot({ path: '/tmp/claude/dashboard-auth.png', fullPage: true });

  await browser.close();
  console.log("\nDone!");
}

test().catch(console.error);
