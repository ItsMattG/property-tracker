import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as base, Page } from "@playwright/test";

// Test user credentials - set these in .env.local
const TEST_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.E2E_CLERK_USER_PASSWORD;

// Extend base test with authenticated page using Clerk testing tokens
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Set up Clerk testing token for this test (bypasses bot detection)
    await setupClerkTestingToken({ page });

    if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
      // Navigate to sign-in page
      await page.goto("/sign-in");

      // Wait for Clerk sign-in form to load
      await page.waitForSelector('[data-clerk-component="SignIn"]', { timeout: 15000 });

      // Fill in the email
      await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);

      // Click continue to get password field (use exact match to avoid Google button)
      await page.getByRole("button", { name: "Continue", exact: true }).click();

      // Wait for password field and fill it
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.waitFor({ timeout: 5000 });
      await passwordInput.fill(TEST_USER_PASSWORD);

      // Click continue to sign in
      await page.getByRole("button", { name: "Continue", exact: true }).click();

      // Wait for sign-in to complete (redirects away from sign-in)
      await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 });

      // Navigate to dashboard (in case it redirected to home)
      await page.goto("/dashboard");
    } else {
      await page.goto("/dashboard");
    }

    await use(page);
  },
});

export { expect } from "@playwright/test";
