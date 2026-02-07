import { chromium } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: ".env.local" });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD!;

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log("Logging in...");

  // Navigate to sign-in page
  await page.goto(`${BASE_URL}/sign-in`);

  // Fill in credentials
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for sign-in to complete
  await page.waitForURL("**/dashboard", { timeout: 15000 });

  console.log("Logged in successfully!");

  const screenshotsDir = path.join(process.cwd(), "public/images/screenshots");

  // Helper to remove Next.js dev elements before screenshot
  async function removeDevElements() {
    await page.evaluate(() => {
      // Remove all possible Next.js dev indicators
      const selectors = [
        'nextjs-portal',
        '[data-nextjs-toast]',
        '[data-nextjs-dialog]',
        '#__next-build-indicator',
        // The floating button in bottom-right corner
        'button[data-nextjs-data-runtime-error-collapsed-action]',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
      // Also remove any fixed position elements in bottom corners (likely dev tools)
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' &&
            (style.bottom === '0px' || parseInt(style.bottom) < 50) &&
            (style.right === '0px' || parseInt(style.right) < 50 ||
             style.left === '0px' || parseInt(style.left) < 50)) {
          const rect = el.getBoundingClientRect();
          // Small fixed elements in corners are likely dev tools
          if (rect.width < 100 && rect.height < 100) {
            (el as HTMLElement).style.display = 'none';
          }
        }
      });
    });
  }

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
  await removeDevElements();
  await page.screenshot({ path: `${screenshotsDir}/dashboard.png` });
  console.log("✓ Dashboard screenshot saved");

  // Screenshot 2: Reports (try portfolio report which shows property summary)
  console.log("Capturing reports...");
  await page.goto(`${BASE_URL}/reports`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await removeDevElements();
  await page.screenshot({ path: `${screenshotsDir}/tax-reports.png` });
  console.log("✓ Reports screenshot saved");

  // Screenshot 3: Banking
  console.log("Capturing banking...");
  await page.goto(`${BASE_URL}/banking`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await removeDevElements();
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
