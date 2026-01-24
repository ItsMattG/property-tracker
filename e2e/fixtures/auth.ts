import { test as base, Page } from "@playwright/test";

// Extend base test with authenticated page
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Set Clerk testing token cookie
    await page.context().addCookies([
      {
        name: "__clerk_testing_token",
        value: process.env.CLERK_TESTING_TOKEN || "",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await use(page);
  },
});

export { expect } from "@playwright/test";
