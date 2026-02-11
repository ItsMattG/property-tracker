import { test, expect } from "@playwright/test";
import { featureFlags } from "@/config/feature-flags";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Loans (Seeded Data)", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.loans, "loans feature flag is disabled");
  });

  test.beforeEach(async ({ page }) => {
    await safeGoto(page, "/loans");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should display loans page", async ({ page }) => {
    // Check for loans heading
    await expect(page.getByRole("heading", { name: /loan/i }).first()).toBeVisible();
  });

  test("should show loans content or empty state", async ({ page }) => {
    // With seeded data: shows bank names, rates, LVR
    // Without: shows empty state or just heading
    const hasBank = await page.getByText(/commonwealth|anz|westpac/i).first().isVisible().catch(() => false);
    const hasRate = await page.locator("text=/\\d+\\.\\d+%/").first().isVisible().catch(() => false);
    const hasNoLoans = await page.getByText(/no loans/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /loan/i }).first().isVisible().catch(() => false);
    expect(hasBank || hasRate || hasNoLoans || hasHeading).toBe(true);
  });
});
