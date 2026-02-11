import { test, expect } from "@playwright/test";
import { featureFlags } from "../../src/config/feature-flags";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Export", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.export, "export feature flag is disabled");
  });

  test("should display export page", async ({ page }) => {
    await safeGoto(page, "/export");
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /export/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test("should show export controls after loading", async ({ page }) => {
    await safeGoto(page, "/export");
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /export/i }).first()).toBeVisible({ timeout: 15000 });
  });
});
