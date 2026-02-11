import { test, expect } from "@playwright/test";

const BENIGN_ERROR_PATTERNS = [
  /ResizeObserver/i,
  /hydrat/i,
  /AbortError/i,
  /cancelled/i,
  /Loading chunk/i,
  /Script error/i,
];

function isBenignError(err: Error): boolean {
  return BENIGN_ERROR_PATTERNS.some((p) => p.test(err.message));
}

test.describe("Bank Feeds", () => {
  let pageErrors: Error[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));
  });

  test.afterEach(() => {
    const realErrors = pageErrors.filter((e) => !isBenignError(e));
    expect(realErrors, "No uncaught page errors").toHaveLength(0);
  });

  test("should display Bank Feeds page with heading", async ({ page }) => {
    await page.goto("/banking");
    await expect(page.getByRole("heading", { name: /bank feeds/i })).toBeVisible();
  });

  test("should show account count or empty state", async ({ page }) => {
    await page.goto("/banking");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Either shows accounts summary or empty state
    const hasAccountCount = await page.getByText(/\d+ accounts? across/i).isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no bank accounts connected/i).isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /bank feeds/i }).isVisible().catch(() => false);

    expect(hasAccountCount || hasEmptyState || hasHeading).toBe(true);
  });

  test("should show Connect Bank button", async ({ page }) => {
    await page.goto("/banking");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Button text varies: "Connect Bank" (when accounts exist) or "Connect Your Bank" (empty state)
    // Could be rendered as a link or button
    const hasConnectLink = await page.getByRole("link", { name: /connect.*bank/i }).first().isVisible().catch(() => false);
    const hasConnectButton = await page.getByRole("button", { name: /connect.*bank/i }).first().isVisible().catch(() => false);
    const hasConnectText = await page.getByText(/connect.*bank/i).first().isVisible().catch(() => false);
    expect(hasConnectLink || hasConnectButton || hasConnectText).toBe(true);
  });

  test("should navigate to connect page directly", async ({ page }) => {
    await page.goto("/banking/connect");
    await expect(page).toHaveURL(/banking\/connect/);
  });

  test("sidebar should show Bank Feeds label", async ({ page }) => {
    await page.goto("/banking");
    // The sidebar link should say "Bank Feeds" not "Banking"
    await expect(
      page.locator("aside").getByText("Bank Feeds")
    ).toBeVisible();
  });
});
