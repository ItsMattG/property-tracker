import { test, expect } from "./fixtures/auth";

test.describe("Dashboard (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should display dashboard page", async ({ authenticatedPage: page }) => {
    // Check for dashboard heading
    await expect(page.getByRole("heading", { name: /dashboard/i }).first()).toBeVisible();
  });

  test("should show dashboard content", async ({ authenticatedPage: page }) => {
    // Dashboard should show portfolio metrics, alerts, or navigation
    const hasDollar = await page.locator("text=/\\$[0-9,]+/").first().isVisible().catch(() => false);
    const hasAlert = await page.getByText(/alert/i).first().isVisible().catch(() => false);
    const hasRecent = await page.getByText(/recent/i).first().isVisible().catch(() => false);
    const hasPortfolio = await page.getByText(/portfolio/i).first().isVisible().catch(() => false);
    const hasNavigation = await page.getByRole("link", { name: /propert/i }).first().isVisible().catch(() => false);
    expect(hasDollar || hasAlert || hasRecent || hasPortfolio || hasNavigation).toBe(true);
  });

  test("should display portfolio summary table with property data", async ({ authenticatedPage: page }) => {
    // Portfolio Summary card should be visible
    const summaryCard = page.getByRole("heading", { name: "Portfolio Summary" });
    await expect(summaryCard).toBeVisible({ timeout: 10000 });

    // Table should have expected column headers
    await expect(page.getByRole("columnheader", { name: "Property" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Value" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Loan" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Equity" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "LVR" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cash" })).toBeVisible();

    // Should have a totals row
    await expect(page.getByRole("cell", { name: "Total" })).toBeVisible();

    // Property rows should link to property detail pages
    const propertyLinks = page.locator("table a[href^='/properties/']");
    const linkCount = await propertyLinks.count();
    expect(linkCount).toBeGreaterThan(0);
  });
});
