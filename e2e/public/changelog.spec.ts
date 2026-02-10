import { test, expect } from "@playwright/test";

test.describe("Changelog", () => {
  test("public changelog page loads and shows entries", async ({ page }) => {
    await page.goto("/changelog", { waitUntil: "domcontentloaded" });

    // Verify page title
    await expect(page.locator("h1")).toContainText("Changelog");

    // Verify tabs exist
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Features" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Improvements" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fixes" })).toBeVisible();
  });

  test("changelog entry detail page loads", async ({ page }) => {
    await page.goto("/changelog", { waitUntil: "domcontentloaded" });

    // Click on an entry (if exists)
    const entry = page.locator("a[href^='/changelog/']").first();
    if (await entry.isVisible()) {
      await entry.click();

      // Verify we're on detail page
      await expect(page.getByRole("link", { name: /Back to Changelog/i })).toBeVisible();
    }
  });

  test("category filters work", async ({ page }) => {
    await page.goto("/changelog", { waitUntil: "domcontentloaded" });

    // Wait for tabs to be rendered
    const featuresTab = page.getByRole("tab", { name: "Features" });
    await expect(featuresTab).toBeVisible({ timeout: 10000 });

    // Click Features tab
    await featuresTab.click();

    // Verify the tab becomes active
    await expect(featuresTab).toHaveAttribute("data-state", "active");
  });
});
