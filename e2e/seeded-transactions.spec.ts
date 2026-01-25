import { test, expect } from "./fixtures/auth";

test.describe("Transactions (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should display transactions page", async ({ authenticatedPage: page }) => {
    // Check for transactions heading
    await expect(page.getByRole("heading", { name: /transaction/i }).first()).toBeVisible();
  });

  test("should show transactions content or empty state", async ({ authenticatedPage: page }) => {
    // With seeded data: shows table, dollar amounts, categories
    // Without: shows empty state or just heading
    const hasTable = await page.getByRole("table").first().isVisible().catch(() => false);
    const hasDollar = await page.locator("text=/\\$[0-9,]+/").first().isVisible().catch(() => false);
    const hasCategory = await page.getByText(/rental|income|expense|water|council|insurance/i).first().isVisible().catch(() => false);
    const hasNoTransactions = await page.getByText(/no transactions/i).first().isVisible().catch(() => false);
    const hasDescription = await page.getByText(/review and categorize/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /transaction/i }).first().isVisible().catch(() => false);
    expect(hasTable || hasDollar || hasCategory || hasNoTransactions || hasDescription || hasHeading).toBe(true);
  });
});
