import { test, expect } from "./fixtures/auth";

test.describe("Dashboard (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("should display property count stat", async ({ authenticatedPage: page }) => {
    // Demo data has 4 properties
    await expect(page.getByText(/4/).first()).toBeVisible();
    await expect(page.getByText(/propert/i).first()).toBeVisible();
  });

  test("should show recent transactions", async ({ authenticatedPage: page }) => {
    // Dashboard should show recent activity
    await expect(
      page.getByText(/recent/i).or(page.getByText(/transaction/i).first())
    ).toBeVisible();
  });

  test("should display alerts if any", async ({ authenticatedPage: page }) => {
    // Demo data has anomaly alerts (missed rent, unusual expense)
    const alertSection = page.getByText(/alert/i).first();
    await expect(alertSection).toBeVisible();
  });

  test("should show portfolio value", async ({ authenticatedPage: page }) => {
    // Dashboard should display portfolio metrics
    await expect(
      page.getByText(/portfolio/i).or(page.getByText(/total value/i))
    ).toBeVisible();
  });

  test("should navigate to portfolio from stats", async ({ authenticatedPage: page }) => {
    // Clicking on property stat should navigate to portfolio
    await page.getByText(/propert/i).first().click();
    await expect(page).toHaveURL(/portfolio|properties/);
  });
});
