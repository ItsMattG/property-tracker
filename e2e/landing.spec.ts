import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display hero section with tagline", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /your spreadsheet/i })).toBeVisible();
    await expect(page.getByText(/automated/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /start free trial/i })).toBeVisible();
  });

  test("should display navigation with sign in and get started", async ({ page }) => {
    await page.goto("/");

    // Use header navigation to be specific since there are multiple sign in links
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("should display feature cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/australian bank feeds/i)).toBeVisible();
    await expect(page.getByText(/ato tax categories/i)).toBeVisible();
    await expect(page.getByText(/bank-grade security/i)).toBeVisible();
  });

  test("should display benefits list", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/automatic transaction import/i)).toBeVisible();
    await expect(page.getByText(/smart categorization/i)).toBeVisible();
    await expect(page.getByText(/one-click export/i)).toBeVisible();
  });

  test("should navigate to sign up when clicking Get Started", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /start free trial/i }).click();
    await expect(page).toHaveURL(/sign-up/);
  });

  test("should navigate to sign in when clicking Sign In", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("should display footer with links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
  });
});
