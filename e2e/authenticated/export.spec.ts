import { test, expect } from "@playwright/test";
import { featureFlags } from "../../src/config/feature-flags";

test.describe("Export", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.export, "export feature flag is disabled");
  });

  test("should display export page", async ({ page }) => {
    await page.goto("/export", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible({ timeout: 15000 });
  });

  test("should show export controls after loading", async ({ page }) => {
    await page.goto("/export", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible({ timeout: 15000 });
  });
});
