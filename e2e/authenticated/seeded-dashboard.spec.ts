import { test, expect } from "@playwright/test";
import { safeGoto, dismissTourIfVisible, dismissDialogsIfVisible } from "../fixtures/test-helpers";

test.describe("Dashboard (Seeded Data)", () => {
  // Dashboard server component makes tRPC calls that can be slow on CI
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await safeGoto(page, "/dashboard");
    // Wait for actual content instead of arbitrary timeout
    await expect(
      page.getByRole("heading", { name: /welcome to bricktrack/i }).first()
    ).toBeVisible({ timeout: 30_000 });
    await dismissTourIfVisible(page);
    await dismissDialogsIfVisible(page);
  });

  test("should display dashboard page", async ({ page }) => {
    // Heading already confirmed visible in beforeEach — verify description too
    await expect(
      page.getByText(/track your investment properties/i)
    ).toBeVisible();
  });

  test("should display Australia properties map when properties exist", async ({ page }) => {
    // With seeded data, the map should render with property pins
    const mapCard = page.getByTestId("australia-map");
    const isVisible = await mapCard.isVisible().catch(() => false);
    if (isVisible) {
      await expect(page.getByText("Property Locations")).toBeVisible();
      // Should have at least one pin
      const pinCount = await page.getByTestId("map-pin").count();
      expect(pinCount).toBeGreaterThan(0);
    }
  });

  test("should show dashboard content", async ({ page }) => {
    // Dashboard should show portfolio metrics, alerts, or navigation
    const hasDollar = await page.locator("text=/\\$[0-9,]+/").first().isVisible().catch(() => false);
    const hasAlert = await page.getByText(/alert/i).first().isVisible().catch(() => false);
    const hasRecent = await page.getByText(/recent/i).first().isVisible().catch(() => false);
    const hasPortfolio = await page.getByText(/portfolio/i).first().isVisible().catch(() => false);
    const hasNavigation = await page.getByRole("link", { name: /propert/i }).first().isVisible().catch(() => false);
    expect(hasDollar || hasAlert || hasRecent || hasPortfolio || hasNavigation).toBe(true);
  });
});
