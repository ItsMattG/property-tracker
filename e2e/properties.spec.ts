import { test, expect } from "./fixtures/auth";

test.describe("Properties", () => {
  test("should display properties page with heading", async ({ authenticatedPage: page }) => {
    await page.goto("/properties");
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();
  });

  test("should display properties description", async ({ authenticatedPage: page }) => {
    await page.goto("/properties");
    await expect(page.getByText(/manage your investment properties/i)).toBeVisible();
  });

  test("should navigate to new property form directly", async ({ authenticatedPage: page }) => {
    await page.goto("/properties/new");
    await expect(page).toHaveURL(/properties\/new/);
  });

  test("should show valuation card on property detail page", async ({ authenticatedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/properties");
    await expect(page.getByRole("heading", { name: /properties/i }).first()).toBeVisible();

    // Check if any property cards exist
    const hasProperties = await page.locator("[data-testid='property-card']").count().then(c => c > 0).catch(() => false);

    if (hasProperties) {
      // Click first property card to go to detail page
      await page.locator("[data-testid='property-card']").first().click();
      await page.waitForURL(/\/properties\/[a-z0-9-]+/, { timeout: 10000 });

      // Valuation section should be visible (feature flag is now enabled)
      await expect(page.getByText("Current Valuation")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/valuation history.*growth/i)).toBeVisible({ timeout: 5000 });
    }

    expect(errors).toHaveLength(0);
  });

  test("should display financial metrics on property cards when data exists", async ({ authenticatedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/properties");
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();

    // Wait for property cards to render (either cards exist or empty state)
    const hasProperties = await page.locator("[data-testid='property-card']").count().then(c => c > 0).catch(() => false);

    if (hasProperties) {
      const firstCard = page.locator("[data-testid='property-card']").first();

      // Check for financial metric labels (these appear when metrics query resolves)
      // Use a generous timeout since metrics is a second query
      await expect(firstCard.getByText("Value")).toBeVisible({ timeout: 10000 });
      await expect(firstCard.getByText("Equity")).toBeVisible({ timeout: 5000 });
      await expect(firstCard.getByText("Monthly Cash Flow")).toBeVisible({ timeout: 5000 });
    }

    expect(errors).toHaveLength(0);
  });

  test("should display performance badge on property cards when metrics loaded", async ({ authenticatedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/properties");
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();

    const hasProperties = await page.locator("[data-testid='property-card']").count().then(c => c > 0).catch(() => false);

    if (hasProperties) {
      const firstCard = page.locator("[data-testid='property-card']").first();
      // Wait for metrics to load (Value label appears when metrics resolve)
      await expect(firstCard.getByText("Value")).toBeVisible({ timeout: 10000 });

      // Performance badge should be visible (data-testid="performance-badge")
      const badge = firstCard.locator("[data-testid='performance-badge']");
      await expect(badge).toBeVisible({ timeout: 5000 });
    }

    expect(errors).toHaveLength(0);
  });
});
