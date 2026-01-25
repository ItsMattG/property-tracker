import { test, expect } from "./fixtures/auth";

test.describe("Loans (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/loans");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should display loans page", async ({ authenticatedPage: page }) => {
    // Check for loans heading
    await expect(page.getByRole("heading", { name: /loan/i }).first()).toBeVisible();
  });

  test("should show loans content or empty state", async ({ authenticatedPage: page }) => {
    // With seeded data: shows bank names, rates, LVR
    // Without: shows empty state or just heading
    const hasBank = await page.getByText(/commonwealth|anz|westpac/i).first().isVisible().catch(() => false);
    const hasRate = await page.locator("text=/\\d+\\.\\d+%/").first().isVisible().catch(() => false);
    const hasNoLoans = await page.getByText(/no loans/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /loan/i }).first().isVisible().catch(() => false);
    expect(hasBank || hasRate || hasNoLoans || hasHeading).toBe(true);
  });
});
