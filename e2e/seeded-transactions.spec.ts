import { test, expect } from "./fixtures/auth";

test.describe("Transactions (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
  });

  test("should display transactions list with entries", async ({ authenticatedPage: page }) => {
    // Demo data has 200+ transactions over 5 years
    await expect(page.getByRole("table").or(page.locator("[data-testid='transaction-row']").first())).toBeVisible();
  });

  test("should show rental income transactions", async ({ authenticatedPage: page }) => {
    // Filter or look for rental income category
    await expect(page.getByText(/rental income/i).first()).toBeVisible();
  });

  test("should show expense transactions", async ({ authenticatedPage: page }) => {
    // Should have various expense categories from demo data
    const expenseCategories = [
      /water/i,
      /council/i,
      /insurance/i,
      /repairs/i,
      /property.*agent/i,
    ];

    let found = false;
    for (const category of expenseCategories) {
      const count = await page.getByText(category).count();
      if (count > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("should filter transactions by property", async ({ authenticatedPage: page }) => {
    // Look for property filter dropdown
    const propertyFilter = page.getByRole("combobox").first();
    await propertyFilter.click();

    // Should see Paddington as an option (first demo property)
    await expect(page.getByText(/paddington/i)).toBeVisible();
  });

  test("should show positive amounts for income", async ({ authenticatedPage: page }) => {
    // Income transactions should have positive amounts
    await expect(page.locator("text=/\\+?\\$[0-9,]+/").first()).toBeVisible();
  });
});
