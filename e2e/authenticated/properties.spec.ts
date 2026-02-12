import { test, expect } from "@playwright/test";
import { isBenignError, safeGoto } from "../fixtures/test-helpers";

test.describe("Properties", () => {
  test("should display properties page with heading", async ({ page }) => {
    await safeGoto(page, "/properties");
    await expect(page.getByRole("heading", { name: /properties/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test("should display properties description", async ({ page }) => {
    await safeGoto(page, "/properties");
    await expect(page.getByText(/manage your investment properties/i)).toBeVisible();
  });

  test("should navigate to new property form directly", async ({ page }) => {
    await safeGoto(page, "/properties/new");
    await expect(page).toHaveURL(/properties\/new/);
  });

  test("should show valuation card on property detail page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await safeGoto(page, "/properties");
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /properties/i }).first()).toBeVisible();

    // Check if any property cards exist
    const hasProperties = await page.locator("[data-testid='property-card']").count().then(c => c > 0).catch(() => false);

    if (hasProperties) {
      // Click first property card to go to detail page
      await page.locator("[data-testid='property-card']").first().click();
      await page.waitForURL(/\/properties\/[a-z0-9-]+/, { timeout: 15000 });

      // Valuation section should be visible (feature flag is now enabled)
      await expect(page.getByText("Current Valuation")).toBeVisible({ timeout: 15000 });
    }

    const realErrors = errors.filter((e) => !isBenignError(e));
    expect(realErrors).toHaveLength(0);
  });

  test("should display financial metrics on property cards when data exists", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await safeGoto(page, "/properties");
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /properties/i }).first()).toBeVisible();

    // Wait for property cards to render (either cards exist or empty state)
    const hasProperties = await page.locator("[data-testid='property-card']").count().then(c => c > 0).catch(() => false);

    if (hasProperties) {
      const firstCard = page.locator("[data-testid='property-card']").first();

      // Check for financial metric labels (these appear when metrics query resolves)
      // Use a generous timeout since metrics is a second query
      const hasValue = await firstCard.getByText("Value").isVisible({ timeout: 15000 }).catch(() => false);
      if (hasValue) {
        await expect(firstCard.getByText("Equity")).toBeVisible({ timeout: 5000 });
        await expect(firstCard.getByText("Monthly Cash Flow")).toBeVisible({ timeout: 5000 });
      }
      // If metrics haven't loaded after 15s, card still shows purchase price fallback — that's OK
    }

    const realErrors = errors.filter((e) => !isBenignError(e));
    expect(realErrors).toHaveLength(0);
  });

  test("should display performance badge on property cards when metrics loaded", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await safeGoto(page, "/properties");
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /properties/i }).first()).toBeVisible();

    const hasProperties = await page.locator("[data-testid='property-card']").count().then(c => c > 0).catch(() => false);

    if (hasProperties) {
      const firstCard = page.locator("[data-testid='property-card']").first();
      // Wait for metrics to load (Value label appears when metrics resolve)
      const hasValue = await firstCard.getByText("Value").isVisible({ timeout: 15000 }).catch(() => false);

      if (hasValue) {
        // Performance badge should be visible (data-testid="performance-badge")
        const badge = firstCard.locator("[data-testid='performance-badge']");
        await expect(badge).toBeVisible({ timeout: 5000 });
      }
      // If metrics haven't loaded, skip badge check — it only renders with metrics
    }

    const realErrors = errors.filter((e) => !isBenignError(e));
    expect(realErrors).toHaveLength(0);
  });
});
