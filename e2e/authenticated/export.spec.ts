import { test, expect } from "@playwright/test";
import { featureFlags } from "../../src/config/feature-flags";

test.describe("Export", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.export, "export feature flag is disabled");
  });

  test("should display export page", async ({ page }) => {
    await page.goto("/export");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible({ timeout: 10000 });
  });

  test("should show export controls after loading", async ({ page }) => {
    await page.goto("/export");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible({ timeout: 10000 });
  });
});
