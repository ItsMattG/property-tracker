import { test, expect } from "./fixtures/auth";

test.describe("Loans (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/loans");
    await page.waitForLoadState("networkidle");
  });

  test("should display 3 active loans", async ({ authenticatedPage: page }) => {
    // Demo data has 3 loans for active properties
    await expect(page.getByText(/commonwealth bank/i)).toBeVisible();
    await expect(page.getByText(/anz/i)).toBeVisible();
    await expect(page.getByText(/westpac/i)).toBeVisible();
  });

  test("should show interest rates", async ({ authenticatedPage: page }) => {
    // Demo rates: 6.29%, 6.45%, 6.15%
    await expect(page.getByText(/6\.\d+%/)).toBeVisible();
  });

  test("should display LVR for loans", async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/lvr/i).first()).toBeVisible();
  });

  test("should show refinance alert for expiring fixed rate", async ({ authenticatedPage: page }) => {
    // Brighton property has fixed rate expiring in 1 month
    const alertIndicators = [
      page.getByText(/expir/i),
      page.getByText(/refinance/i),
      page.locator("[data-testid='refinance-alert']"),
      page.getByRole("alert"),
    ];

    let alertFound = false;
    for (const indicator of alertIndicators) {
      if (await indicator.count() > 0) {
        alertFound = true;
        break;
      }
    }
    expect(alertFound).toBe(true);
  });

  test("should show loan type (P&I vs IO)", async ({ authenticatedPage: page }) => {
    // Demo has both P&I and Interest Only loans
    await expect(
      page.getByText(/principal.*interest/i).or(page.getByText(/p&i/i))
    ).toBeVisible();
    await expect(
      page.getByText(/interest only/i).or(page.getByText(/io\b/i))
    ).toBeVisible();
  });
});
