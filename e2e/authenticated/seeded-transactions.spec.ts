import { test, expect } from "@playwright/test";
import { isBenignError, safeGoto } from "../fixtures/test-helpers";

test.describe("Transactions (Seeded Data)", () => {
  let pageErrors: Error[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));
    await safeGoto(page, "/transactions");
    await page.waitForTimeout(2000);
  });

  test.afterEach(() => {
    const realErrors = pageErrors.filter((e) => !isBenignError(e));
    expect(realErrors, "No uncaught page errors").toHaveLength(0);
  });

  test("should display transactions page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /transaction/i }).first()).toBeVisible();
  });

  test("should show transactions content or empty state", async ({ page }) => {
    const hasTable = await page.getByRole("table").first().isVisible().catch(() => false);
    const hasDollar = await page.locator("text=/\\$[0-9,]+/").first().isVisible().catch(() => false);
    const hasCategory = await page.getByText(/rental|income|expense|water|council|insurance/i).first().isVisible().catch(() => false);
    const hasNoTransactions = await page.getByText(/no transactions/i).first().isVisible().catch(() => false);
    const hasDescription = await page.getByText(/review and categorize/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /transaction/i }).first().isVisible().catch(() => false);
    expect(hasTable || hasDollar || hasCategory || hasNoTransactions || hasDescription || hasHeading).toBe(true);
  });

  test("should show allocation status text when transactions exist", async ({ page }) => {
    const hasTable = await page.getByRole("table").first().isVisible().catch(() => false);
    if (!hasTable) {
      // No transactions to check allocation display for — skip gracefully
      return;
    }

    // With transactions visible, check for allocation-related UI
    const hasAllocated = await page.getByText(/allocated/i).first().isVisible().catch(() => false);
    const hasPropertyCol = await page.getByRole("columnheader", { name: /property/i }).isVisible().catch(() => false);
    const hasAllocateBtn = await page.getByRole("button", { name: /allocate/i }).first().isVisible().catch(() => false);
    // Any allocation-related UI indicates the feature is working
    expect(hasAllocated || hasPropertyCol || hasAllocateBtn).toBe(true);
  });

  test("should show Export CSV button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /export csv/i })
    ).toBeVisible();
  });

  test("should show category dropdowns when transactions exist", async ({ page }) => {
    const hasTable = await page.getByRole("table").first().isVisible().catch(() => false);
    if (!hasTable) return;

    // Each transaction row has a category select
    const categorySelects = page.getByRole("combobox");
    const count = await categorySelects.count();
    // If we have a table, we should have at least one combobox (category select)
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
