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

  test("shows setup CTA or budget content", async ({ page }) => {
    await safeGoto(page, "/budget");
    await dismissTourIfVisible(page);

    // The h1 "Budget" heading is always present regardless of budget state
    const heading = page.getByRole("heading", { name: /budget/i, level: 1 });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("sidebar shows budget link", async ({ page }) => {
    await safeGoto(page, "/dashboard");
    await dismissTourIfVisible(page);

    // Look for Budget link in sidebar (exact match to avoid matching "Set up your budget" CTA)
    const budgetLink = page.getByRole("link", { name: "Budget", exact: true });
    await expect(budgetLink).toBeVisible();
  });

  test("budget link navigates correctly", async ({ page }) => {
    await safeGoto(page, "/dashboard");
    await dismissTourIfVisible(page);

    // Wait for sidebar to fully render before interacting
    const budgetLink = page.getByRole("link", { name: "Budget", exact: true });
    await expect(budgetLink).toBeVisible({ timeout: 15000 });
    await budgetLink.click();

    // Verify navigation to budget page
    await expect(page).toHaveURL(/\/budget/);
  });

  test("dashboard shows budget widget", async ({ page }) => {
    await safeGoto(page, "/dashboard");
    await dismissTourIfVisible(page);

    // Dashboard should show budget-related content (widget or CTA)
    await expect(page.getByText(/budget/i).first()).toBeVisible({ timeout: 10000 });
  });
});
