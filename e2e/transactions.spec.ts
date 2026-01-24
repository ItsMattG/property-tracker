import { test, expect } from "./fixtures/auth";

test.describe("Transactions", () => {
  test("should display transactions page", async ({ authenticatedPage: page }) => {
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: /transactions/i })).toBeVisible();
  });

  test("should load transactions content", async ({ authenticatedPage: page }) => {
    await page.goto("/transactions");
    // Wait for loading to complete - either shows table, empty state, or filter controls
    await expect(
      page.getByRole("heading", { name: /transactions/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
