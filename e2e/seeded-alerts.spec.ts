import { test, expect } from "./fixtures/auth";

test.describe("Alerts (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/alerts");
    await page.waitForLoadState("networkidle");
  });

  test("should display alerts page", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /alert/i })).toBeVisible();
  });

  test("should show missed rent alert", async ({ authenticatedPage: page }) => {
    // Demo data has missed rent alert for Brighton property
    await expect(page.getByText(/missed.*rent/i).or(page.getByText(/rent.*not received/i))).toBeVisible();
  });

  test("should show unusual expense alert", async ({ authenticatedPage: page }) => {
    // Demo data has unusual plumber expense alert
    await expect(
      page.getByText(/unusual/i).or(page.getByText(/plumber/i))
    ).toBeVisible();
  });

  test("should show alert severity", async ({ authenticatedPage: page }) => {
    // Alerts should have severity indicators (warning, info)
    await expect(
      page.getByText(/warning/i).or(page.locator("[data-severity]").first())
    ).toBeVisible();
  });

  test("should link alerts to properties", async ({ authenticatedPage: page }) => {
    // Alerts should mention property names
    await expect(
      page.getByText(/brighton/i).or(page.getByText(/paddington/i))
    ).toBeVisible();
  });
});
