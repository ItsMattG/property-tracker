import { test, expect } from "./fixtures/auth";
import { featureFlags } from "@/config/feature-flags";

test.describe("Export", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.export, "export feature flag is disabled");
  });

  test("should display export page", async ({ authenticatedPage: page }) => {
    await page.goto("/export");
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible();
  });

  test("should show export controls after loading", async ({ authenticatedPage: page }) => {
    await page.goto("/export");
    // Wait for page content to load
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible({ timeout: 10000 });
  });
});
