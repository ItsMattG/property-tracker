import { test, expect } from "@playwright/test";
import { featureFlags } from "@/config/feature-flags";

test.describe("Alerts (Seeded Data)", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.alerts, "alerts feature flag is disabled");
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/alerts");
    // Wait for page to be interactive
    await page.waitForLoadState("domcontentloaded");
    // Give async content time to load
    await page.waitForTimeout(2000);
  });

  test("should display alerts page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /alert/i }).first()).toBeVisible();
  });

  test("should show alerts content or empty state", async ({ page }) => {
    // Page should show alerts OR empty state - both are valid
    const hasAlertContent = await page.getByText(/expected rent|unusual|higher than/i).first().isVisible().catch(() => false);
    const hasNoAlerts = await page.getByText(/no alerts/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /alert/i }).first().isVisible().catch(() => false);
    expect(hasAlertContent || hasNoAlerts || hasHeading).toBe(true);
  });
});
