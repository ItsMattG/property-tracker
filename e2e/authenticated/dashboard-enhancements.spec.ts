import { test, expect } from "@playwright/test";
import { featureFlags } from "../../src/config/feature-flags";

test.describe("Dashboard Enhancements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  // ── FY Selector ──────────────────────────────────────────────────────

  test("should display FY selector in header", async ({
    page,
  }) => {
    test.skip(!featureFlags.fySelector, "FY selector feature flag is disabled");
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    const header = page.locator("header");
    await expect(header.getByRole("combobox", { name: /financial year/i })).toBeVisible();

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });

  test("FY selector should default to current financial year", async ({
    page,
  }) => {
    test.skip(!featureFlags.fySelector, "FY selector feature flag is disabled");
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    const header = page.locator("header");
    const fySelector = header.getByRole("combobox", { name: /financial year/i });

    // Current date is Feb 2026, so current FY is 2025-26
    await expect(fySelector).toContainText("FY 2025-26");

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });

  test("FY selector should show dropdown options when clicked", async ({
    page,
  }) => {
    test.skip(!featureFlags.fySelector, "FY selector feature flag is disabled");
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    const header = page.locator("header");
    const fySelector = header.getByRole("combobox", { name: /financial year/i });
    await fySelector.click();

    // Should show current + 2 previous FYs
    await expect(page.getByRole("option", { name: /FY 2025-26/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /FY 2024-25/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /FY 2023-24/i })).toBeVisible();

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });

  // ── LVR Gauge ────────────────────────────────────────────────────────

  test("should display LVR gauge card on dashboard", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await expect(page.getByText("Portfolio LVR")).toBeVisible();

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });

  test("LVR gauge card should show percentage or empty state", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    const lvrCard = page.locator("[data-testid='lvr-gauge-card']");
    await expect(lvrCard).toBeVisible();

    // Should show either an LVR percentage or an empty state message
    const hasPercentage = await lvrCard.getByText(/%/).isVisible().catch(() => false);
    const hasEmptyState = await lvrCard.getByText(/add properties/i).isVisible().catch(() => false);

    expect(hasPercentage || hasEmptyState).toBeTruthy();

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });

  // ── Equity Projection Chart ──────────────────────────────────────────

  test("should display equity projection card on dashboard", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await expect(page.getByText("Equity Projection")).toBeVisible();

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });

  test("equity projection card should show chart or empty state", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    const projectionCard = page.locator("[data-testid='equity-projection-card']");
    await expect(projectionCard).toBeVisible();

    // Should show either a chart (recharts container) or an empty state
    const hasChart = await projectionCard.locator(".recharts-responsive-container").isVisible().catch(() => false);
    const hasEmptyState = await projectionCard.getByText(/add properties/i).isVisible().catch(() => false);

    expect(hasChart || hasEmptyState).toBeTruthy();

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });

  // ── No page errors ──────────────────────────────────────────────────

  test("dashboard should load without any console errors", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    // Dashboard is loaded by beforeEach
    await expect(
      page.getByRole("heading", { name: /welcome to bricktrack/i })
    ).toBeVisible();

    expect(errors, "No uncaught page errors").toHaveLength(0);
  });
});
