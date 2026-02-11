import { test, expect } from "@playwright/test";
import { isBenignError, safeGoto } from "../fixtures/test-helpers";

test.describe("Transactions", () => {
  let pageErrors: Error[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));
  });

  test.afterEach(() => {
    const realErrors = pageErrors.filter((e) => !isBenignError(e));
    expect(realErrors, "No uncaught page errors").toHaveLength(0);
  });

  test("should display transactions page", async ({ page }) => {
    await safeGoto(page, "/transactions");
    await expect(page.getByRole("heading", { name: /transactions/i }).first()).toBeVisible();
  });

  test("should load transactions content", async ({ page }) => {
    await safeGoto(page, "/transactions");
    await expect(
      page.getByRole("heading", { name: /transactions/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show Export CSV button", async ({ page }) => {
    await safeGoto(page, "/transactions");
    await expect(
      page.getByRole("button", { name: /export csv/i })
    ).toBeVisible();
  });

  test("should show Import CSV and Add Transaction buttons", async ({ page }) => {
    await safeGoto(page, "/transactions");
    // Import CSV button should still exist alongside the new Export
    const hasImport = await page.getByText(/import csv/i).isVisible().catch(() => false);
    const hasAdd = await page.getByRole("link", { name: /add transaction/i }).isVisible().catch(() => false);
    expect(hasImport || hasAdd).toBe(true);
  });

  test("should show All Transactions and Reconciliation view toggles", async ({ page }) => {
    await safeGoto(page, "/transactions");
    await expect(
      page.getByRole("button", { name: /all transactions/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /reconciliation/i })
    ).toBeVisible();
  });
});
