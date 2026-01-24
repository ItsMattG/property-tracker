import { test, expect } from "./fixtures/auth";

test.describe("Export", () => {
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
