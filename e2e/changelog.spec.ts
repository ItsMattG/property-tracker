import { test, expect } from "@playwright/test";

test.describe("Changelog", () => {
  test("public changelog page loads and shows entries", async ({ page }) => {
    await page.goto("/changelog");

    // Verify page title
    await expect(page.locator("h1")).toContainText("Changelog");

    // Verify tabs exist
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Features" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Improvements" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Fixes" })).toBeVisible();
  });

  test("changelog entry detail page loads", async ({ page }) => {
    await page.goto("/changelog");

    // Click on an entry (if exists)
    const entry = page.locator("a[href^='/changelog/']").first();
    if (await entry.isVisible()) {
      await entry.click();

      // Verify we're on detail page
      await expect(page.getByRole("link", { name: /Back to Changelog/i })).toBeVisible();
    }
  });

  test("category filters work", async ({ page }) => {
    await page.goto("/changelog");

    // Click Features tab
    await page.getByRole("tab", { name: "Features" }).click();

    // Verify we're on the features tab
    await expect(page.getByRole("tab", { name: "Features" })).toHaveAttribute(
      "data-state",
      "active"
    );
  });
});
