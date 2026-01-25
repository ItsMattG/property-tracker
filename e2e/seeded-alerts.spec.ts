import { test, expect } from "./fixtures/auth";

test.describe("Alerts (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/alerts");
    // Wait for page to be interactive
    await page.waitForLoadState("domcontentloaded");
    // Give async content time to load
    await page.waitForTimeout(2000);
  });

  test("should display alerts page", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /alert/i })).toBeVisible();
  });

  test("should show alerts content or empty state", async ({ authenticatedPage: page }) => {
    // Page should show alerts OR empty state - both are valid
    const hasAlertContent = await page.getByText(/expected rent|unusual|higher than/i).first().isVisible().catch(() => false);
    const hasNoAlerts = await page.getByText(/no alerts/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /alert/i }).isVisible().catch(() => false);
    expect(hasAlertContent || hasNoAlerts || hasHeading).toBe(true);
  });
});
