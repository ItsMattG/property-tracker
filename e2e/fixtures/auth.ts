import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
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
      // Sign in with test user credentials
      await page.goto("/sign-in");

      await clerk.signIn({
        page,
        signInParams: {
          strategy: "password",
          identifier: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
        },
      });
    }

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await use(page);
  },
});

export { expect } from "@playwright/test";
