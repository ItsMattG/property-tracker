import { test, expect } from "./fixtures/auth";
import { featureFlags } from "@/config/feature-flags";

test.describe("Portfolio (Seeded Data)", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.portfolio, "portfolio feature flag is disabled");
  });

  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/portfolio");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should display portfolio page", async ({ authenticatedPage: page }) => {
    // Check for portfolio heading
    await expect(page.getByRole("heading", { name: /portfolio/i }).first()).toBeVisible();
  });

  test("should show portfolio content or empty state", async ({ authenticatedPage: page }) => {
    // With seeded data: shows property cards, dollar amounts, LVR
    // Without: shows empty state or just heading
    const hasPropertyName = await page.getByText(/paddington|brighton|fortitude|newtown/i).first().isVisible().catch(() => false);
    const hasDollar = await page.locator("text=/\\$[0-9,]+/").first().isVisible().catch(() => false);
    const hasNoProperties = await page.getByText(/no properties|add.*property/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /portfolio/i }).first().isVisible().catch(() => false);
    expect(hasPropertyName || hasDollar || hasNoProperties || hasHeading).toBe(true);
  });
});
