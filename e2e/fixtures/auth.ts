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

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD;

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
      await page.goto("/sign-in");
      await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
      await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL("**/dashboard", { timeout: 15000 });
    } else {
      console.warn("E2E credentials not set - skipping auth");
      await page.goto("/dashboard");
    }

    await use(page);
  },
});

export { expect } from "@playwright/test";
