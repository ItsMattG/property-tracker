import { test, expect } from "@playwright/test";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Blog", () => {
  test("public blog page loads and shows heading", async ({ page }) => {
    await safeGoto(page, "/blog");

    await expect(page.locator("h1")).toContainText("Blog");
    await expect(
      page.getByText(/property investment insights/i)
    ).toBeVisible();
  });

  test("blog page shows category tabs", async ({ page }) => {
    await safeGoto(page, "/blog");

    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Fundamentals" })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Strategy" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Finance" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Tax" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Advanced" })).toBeVisible();
  });

  test("category tab filtering works", async ({ page }) => {
    await safeGoto(page, "/blog");

    await page.getByRole("tab", { name: "Fundamentals" }).click();
    await expect(
      page.getByRole("tab", { name: "Fundamentals" })
    ).toHaveAttribute("data-state", "active");
  });

  test("blog article detail page loads", async ({ page }) => {
    await safeGoto(page, "/blog");

    const article = page.locator("a[href^='/blog/']").first();
    if (await article.isVisible()) {
      await article.click();

      await expect(
        page.getByRole("link", { name: /Back to Blog/i })
      ).toBeVisible();
    }
  });

  test("blog article shows CTA banner", async ({ page }) => {
    await safeGoto(page, "/blog");

    const article = page.locator("a[href^='/blog/']").first();
    if (await article.isVisible()) {
      await article.click();

      await expect(
        page.getByText(/track your property portfolio/i)
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /start free/i })
      ).toBeVisible();
    }
  });

  test("blog header has navigation links", async ({ page }) => {
    await safeGoto(page, "/blog");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(
      header.getByRole("link", { name: /get started/i })
    ).toBeVisible();
  });
});
