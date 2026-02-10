import { test, expect } from "@playwright/test";
import { featureFlags } from "@/config/feature-flags";

test.describe("Compliance (Seeded Data)", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.compliance, "compliance feature flag is disabled");
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/reports/compliance");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should display compliance page", async ({ page }) => {
    // Check for compliance or calendar heading
    await expect(
      page.getByRole("heading").filter({ hasText: /compliance|calendar/i }).first()
    ).toBeVisible();
  });

  test("should show compliance content or empty state", async ({ page }) => {
    // With seeded data: shows compliance items
    // Without: shows empty state or description
    const hasContent = await page.locator("table, [data-testid], .card, article").first().isVisible().catch(() => false);
    const hasNoItems = await page.getByText(/no compliance items/i).first().isVisible().catch(() => false);
    const hasDescription = await page.getByText(/track compliance requirements/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading").filter({ hasText: /compliance|calendar/i }).first().isVisible().catch(() => false);
    expect(hasContent || hasNoItems || hasDescription || hasHeading).toBe(true);
  });
});
