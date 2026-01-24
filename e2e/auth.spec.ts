import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Unauthenticated Users", () => {
    test("should redirect /dashboard to sign-in", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /properties to sign-in", async ({ page }) => {
      await page.goto("/properties");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /transactions to sign-in", async ({ page }) => {
      await page.goto("/transactions");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /banking to sign-in", async ({ page }) => {
      await page.goto("/banking");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /export to sign-in", async ({ page }) => {
      await page.goto("/export");
      await expect(page).toHaveURL(/sign-in/);
    });
  });

  test.describe("Sign In Page", () => {
    test("should display Clerk sign-in component", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page).toHaveURL(/sign-in/);
      // Wait for Clerk to load
      await page.waitForSelector('[data-clerk-component="SignIn"], .cl-signIn-root', { timeout: 10000 });
    });

    test("should have link to sign up", async ({ page }) => {
      await page.goto("/sign-in");
      await page.waitForSelector('[data-clerk-component="SignIn"], .cl-signIn-root', { timeout: 10000 });
      // Clerk's sign-in component includes a sign-up link
      await expect(page.getByText(/sign up/i)).toBeVisible();
    });
  });

  test.describe("Sign Up Page", () => {
    test("should display Clerk sign-up component", async ({ page }) => {
      await page.goto("/sign-up");
      await expect(page).toHaveURL(/sign-up/);
      // Wait for Clerk to load
      await page.waitForSelector('[data-clerk-component="SignUp"], .cl-signUp-root', { timeout: 10000 });
    });

    test("should have link to sign in", async ({ page }) => {
      await page.goto("/sign-up");
      await page.waitForSelector('[data-clerk-component="SignUp"], .cl-signUp-root', { timeout: 10000 });
      // Clerk's sign-up component includes a sign-in link
      await expect(page.getByText(/sign in/i)).toBeVisible();
    });
  });
});
