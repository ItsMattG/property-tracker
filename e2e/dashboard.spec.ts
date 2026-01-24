import { test, expect } from "./fixtures/auth";

// These tests require test user credentials to be configured in .env.local
// E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD
const hasTestUserCredentials =
  !!process.env.E2E_CLERK_USER_EMAIL && !!process.env.E2E_CLERK_USER_PASSWORD;

test.describe("Dashboard", () => {
  test.skip(!hasTestUserCredentials, "Requires E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD in .env.local");
  test("should display welcome message", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /welcome to propertytracker/i })).toBeVisible();
  });

  test("should display stats cards", async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/properties/i).first()).toBeVisible();
    await expect(page.getByText(/transactions/i).first()).toBeVisible();
    await expect(page.getByText(/uncategorized/i)).toBeVisible();
  });

  test("should display sidebar navigation", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /properties/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /transactions/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /banking/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /export/i })).toBeVisible();
  });

  test("should navigate to properties from sidebar", async ({ authenticatedPage: page }) => {
    await page.getByRole("link", { name: /properties/i }).click();
    await expect(page).toHaveURL(/properties/);
  });

  test("should navigate to transactions from sidebar", async ({ authenticatedPage: page }) => {
    await page.getByRole("link", { name: /transactions/i }).click();
    await expect(page).toHaveURL(/transactions/);
  });
});
