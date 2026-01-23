import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should redirect unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to sign-in page
    await expect(page).toHaveURL(/sign-in/);
  });

  test("should show sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/sign-in/);
    // Clerk sign-in component should be visible
    await expect(page.locator('[data-clerk-component]')).toBeVisible();
  });

  test("should show sign-up page", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/sign-up/);
    // Clerk sign-up component should be visible
    await expect(page.locator('[data-clerk-component]')).toBeVisible();
  });
});

// Note: Full authentication flow tests require:
// 1. Clerk test credentials
// 2. Test user accounts
// These should be added when deploying to staging
