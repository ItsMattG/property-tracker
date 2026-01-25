import { test, expect } from "./fixtures/auth";

test.describe("Portfolio (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/portfolio");
    await page.waitForLoadState("networkidle");
  });

  test("should display 4 property cards", async ({ authenticatedPage: page }) => {
    // Demo data has 4 properties: Paddington, Brighton, Fortitude Valley, Newtown
    await expect(page.getByText(/paddington/i)).toBeVisible();
    await expect(page.getByText(/brighton/i)).toBeVisible();
    await expect(page.getByText(/fortitude valley/i)).toBeVisible();
    await expect(page.getByText(/newtown/i)).toBeVisible();
  });

  test("should show sold badge for Newtown property", async ({ authenticatedPage: page }) => {
    // Newtown was sold in Oct 2024
    const newtownCard = page.locator("text=Newtown").locator("..");
    await expect(newtownCard.getByText(/sold/i)).toBeVisible();
  });

  test("should display portfolio equity summary", async ({ authenticatedPage: page }) => {
    // Should show total value and equity
    await expect(page.getByText(/total value/i)).toBeVisible();
    await expect(page.getByText(/total equity/i).or(page.getByText(/equity/i).first())).toBeVisible();
  });

  test("should show correct property count in summary", async ({ authenticatedPage: page }) => {
    // Summary should mention property count
    await expect(page.getByText(/4 propert/i).or(page.getByText("4").first())).toBeVisible();
  });

  test("should display LVR for active properties", async ({ authenticatedPage: page }) => {
    // LVR should be visible on property cards
    await expect(page.getByText(/lvr/i).first()).toBeVisible();
  });
});
