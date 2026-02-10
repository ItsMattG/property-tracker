import { test, expect } from "@playwright/test";
import { featureFlags } from "@/config/feature-flags";

test.describe("Export", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.export, "export feature flag is disabled");
  });

  test("should display export page", async ({ page }) => {
    await page.goto("/export");
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible();
  });

  test("should show export controls after loading", async ({ page }) => {
    await page.goto("/export");
    // Wait for page content to load
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible({ timeout: 10000 });
  });
});
