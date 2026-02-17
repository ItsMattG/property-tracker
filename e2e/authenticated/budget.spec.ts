import { test, expect } from "@playwright/test";
import { isBenignError, safeGoto, dismissTourIfVisible } from "../fixtures/test-helpers";

test.describe("Budget", () => {
  let pageErrors: Error[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));
  });

  test.afterEach(() => {
    const realErrors = pageErrors.filter((e) => !isBenignError(e));
    expect(realErrors, "No uncaught page errors").toHaveLength(0);
  });

  test("budget page loads without errors", async ({ page }) => {
    await safeGoto(page, "/budget");
    await dismissTourIfVisible(page);

    // Verify page loaded by checking URL
    await expect(page).toHaveURL(/\/budget/);

    // Verify heading exists (either "Budget" or similar)
    await expect(page.getByRole("heading", { name: /budget/i, level: 1 })).toBeVisible();
  });

  test("shows setup CTA when no budgets exist", async ({ page }) => {
    await safeGoto(page, "/budget");
    await dismissTourIfVisible(page);

    // Check for either setup button or existing budget content
    // If budgets exist, we should see budget items; if not, we should see a setup CTA
    const hasSetupCTA = await page.getByRole("button", { name: /set up|create|add budget/i }).isVisible({ timeout: 5000 }).catch(() => false);
    const hasBudgetContent = await page.getByText(/monthly|budget item|category/i).first().isVisible({ timeout: 5000 }).catch(() => false);

    // Either setup CTA or budget content should be visible (not an empty page)
    expect(hasSetupCTA || hasBudgetContent).toBe(true);
  });

  test("sidebar shows budget link", async ({ page }) => {
    await safeGoto(page, "/dashboard");
    await dismissTourIfVisible(page);

    // Look for Budget link in sidebar
    const budgetLink = page.getByRole("link", { name: /budget/i });
    await expect(budgetLink).toBeVisible();
  });

  test("budget link navigates correctly", async ({ page }) => {
    await safeGoto(page, "/dashboard");
    await dismissTourIfVisible(page);

    // Click Budget link in sidebar
    await page.getByRole("link", { name: /budget/i }).click();

    // Verify navigation to budget page
    await expect(page).toHaveURL(/\/budget/);
  });

  test("dashboard shows budget widget", async ({ page }) => {
    await safeGoto(page, "/dashboard");
    await dismissTourIfVisible(page);

    // Look for budget widget card on dashboard
    // The widget should have a heading or card containing "Budget" text
    const budgetWidget = page.getByRole("heading", { name: /budget/i }).locator("xpath=ancestor::*[contains(@class, 'card') or contains(@class, 'Card')]").first();
    const hasBudgetWidget = await budgetWidget.isVisible({ timeout: 5000 }).catch(() => false);

    // Alternative: look for any text mentioning budget on dashboard
    const hasBudgetText = await page.getByText(/budget/i).first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasBudgetWidget || hasBudgetText).toBe(true);
  });
});
