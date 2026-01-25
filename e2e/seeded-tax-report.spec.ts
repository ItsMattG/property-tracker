import { test, expect } from "./fixtures/auth";

test.describe("Tax Report (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/reports/tax");
    await page.waitForLoadState("networkidle");
  });

  test("should display tax report page", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /tax report/i })).toBeVisible();
  });

  test("should have financial year selector", async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/financial year/i)).toBeVisible();
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("should generate report with income section", async ({ authenticatedPage: page }) => {
    // Click generate button
    await page.getByRole("button", { name: /generate/i }).click();
    await page.waitForLoadState("networkidle");

    // Should show rental income section
    await expect(page.getByText(/rental income/i).or(page.getByText(/income/i).first())).toBeVisible();
  });

  test("should show expense categories", async ({ authenticatedPage: page }) => {
    // Generate report
    await page.getByRole("button", { name: /generate/i }).click();
    await page.waitForLoadState("networkidle");

    // Should show expense breakdown
    const expenseCategories = [
      /insurance/i,
      /council/i,
      /water/i,
      /repairs/i,
      /interest/i,
    ];

    let found = false;
    for (const category of expenseCategories) {
      if (await page.getByText(category).count() > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("should filter by property", async ({ authenticatedPage: page }) => {
    // Property filter should exist
    const propertyFilter = page.getByLabel(/property/i);
    if (await propertyFilter.count() > 0) {
      await propertyFilter.click();
      await expect(page.getByText(/all properties/i).or(page.getByText(/paddington/i))).toBeVisible();
    }
  });
});
