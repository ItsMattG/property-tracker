import { chromium } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { config } from "dotenv";
import path from "path";

config({ path: ".env.local" });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const TEST_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.E2E_CLERK_USER_PASSWORD!;

async function captureScreenshots() {
  // Initialize Clerk testing environment
  await clerkSetup();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Set up Clerk testing token
  await setupClerkTestingToken({ page });

  console.log("Logging in...");

  // Navigate to sign-in page
  await page.goto(`${BASE_URL}/sign-in`);

  // Wait for Clerk sign-in form to load
  await page.waitForSelector('[data-clerk-component="SignIn"]', { timeout: 15000 });

  // Fill in the email
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);

  // Click continue to get password field
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Wait for password field and fill it
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ timeout: 5000 });
  await passwordInput.fill(TEST_USER_PASSWORD);

  // Click continue to sign in
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Wait for sign-in to complete
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 });

  console.log("Logged in successfully!");

  const screenshotsDir = path.join(process.cwd(), "public/images/screenshots");

  // Screenshot 1: Dashboard
  console.log("Capturing dashboard...");
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState("networkidle");
  // Wait for dashboard content to load
  await page.waitForSelector("text=Welcome to BrickTrack", { timeout: 10000 }).catch(() => {
    // Try alternate selector if welcome message not found
    return page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 }).catch(() => {});
  });
  // Give charts/widgets time to render
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${screenshotsDir}/dashboard.png` });
  console.log("✓ Dashboard screenshot saved");

  // Screenshot 2: Reports (try portfolio report which shows property summary)
  console.log("Capturing reports...");
  await page.goto(`${BASE_URL}/reports`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${screenshotsDir}/tax-reports.png` });
  console.log("✓ Reports screenshot saved");

  // Screenshot 3: Banking
  console.log("Capturing banking...");
  await page.goto(`${BASE_URL}/banking`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${screenshotsDir}/banking.png` });
  console.log("✓ Banking screenshot saved");

  await browser.close();
  console.log("\nAll screenshots captured successfully!");
  console.log(`Screenshots saved to: ${screenshotsDir}`);
}

captureScreenshots().catch((error) => {
  console.error("Error capturing screenshots:", error);
  process.exit(1);
});
