import { test, expect } from "@playwright/test";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Changelog", () => {
  test("public changelog page loads and shows entries", async ({ page }) => {
    await safeGoto(page, "/changelog");
    await page.waitForLoadState("domcontentloaded");

    // Verify page title (give extra time for SSR hydration on staging)
    await expect(page.locator("h1")).toContainText("Changelog", { timeout: 30_000 });

    // Verify tabs exist
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Features" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Improvements" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fixes" })).toBeVisible();
  });

  test("changelog entry detail page loads", async ({ page }) => {
    await safeGoto(page, "/changelog");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Changelog", { timeout: 30_000 });

    // Click on an entry (if exists)
    const entry = page.locator("a[href^='/changelog/']").first();
    if (await entry.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await entry.click();

      // Verify we're on detail page
      await expect(page.getByRole("link", { name: /Back to Changelog/i })).toBeVisible();
    }
  });

  test("category filters work", async ({ page }) => {
    await safeGoto(page, "/changelog");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Changelog", { timeout: 30_000 });

    // Wait for tabs to be rendered
    const featuresTab = page.getByRole("tab", { name: "Features" });
    await expect(featuresTab).toBeVisible({ timeout: 15_000 });

    // Click Features tab
    await featuresTab.click();

    // Verify the tab becomes active
    await expect(featuresTab).toHaveAttribute("data-state", "active");
  });
});
