/**
 * Legacy auth fixture — kept for backward compatibility.
 *
 * With the new project-based auth (auth.setup.ts + storageState),
 * authenticated projects load cookies automatically. Tests should
 * use standard `{ page }` from @playwright/test instead.
 *
 * This fixture is only needed if a test is run outside the
 * "authenticated" or "core-loop" projects.
 */
import { test as base, Page } from "@playwright/test";
import { safeGoto } from "./test-helpers";

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD;

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Auth session is pre-loaded via storageState from the setup project.
    // Just navigate to dashboard — cookies are already in the browser context.
    await safeGoto(page, "/dashboard");

    // If redirected to sign-in (storageState expired or missing), login manually
    if (page.url().includes("/sign-in")) {
      if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
        await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
        await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
        await page.getByRole("button", { name: /sign in/i }).click();
      }
    }

    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await use(page);
  },
});

export { expect } from "@playwright/test";
