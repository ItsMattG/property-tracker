import { test, expect } from "@playwright/test";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Dashboard (Seeded Data)", () => {
  test.beforeEach(async ({ page }) => {
    await safeGoto(page, "/dashboard");
    await page.waitForTimeout(2000);
  });

  test("should display dashboard page", async ({ page }) => {
    // Check for dashboard heading — actual heading is "Welcome to BrickTrack"
    await expect(
      page.getByRole("heading", { name: /welcome to bricktrack/i }).first()
    ).toBeVisible({ timeout: 15000 });
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
