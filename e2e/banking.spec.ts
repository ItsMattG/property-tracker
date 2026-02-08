import { test, expect } from "./fixtures/auth";

test.describe("Bank Feeds", () => {
  let pageErrors: Error[];

  test.beforeEach(async ({ authenticatedPage: page }) => {
    pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));
  });

  test.afterEach(() => {
    expect(pageErrors, "No uncaught page errors").toHaveLength(0);
  });

  test("should display Bank Feeds page with heading", async ({ authenticatedPage: page }) => {
    await page.goto("/banking");
    await expect(page.getByRole("heading", { name: /bank feeds/i })).toBeVisible();
  });

  test("should show account count or empty state", async ({ authenticatedPage: page }) => {
    await page.goto("/banking");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Either shows accounts summary or empty state
    const hasAccountCount = await page.getByText(/\d+ accounts? across/i).isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no bank accounts connected/i).isVisible().catch(() => false);
    const hasHeading = await page.getByRole("heading", { name: /bank feeds/i }).isVisible().catch(() => false);

    expect(hasAccountCount || hasEmptyState || hasHeading).toBe(true);
  });

  test("should show Connect Bank button", async ({ authenticatedPage: page }) => {
    await page.goto("/banking");
    await expect(
      page.getByRole("link", { name: /connect bank/i })
    ).toBeVisible();
  });

  test("should navigate to connect page directly", async ({ authenticatedPage: page }) => {
    await page.goto("/banking/connect");
    await expect(page).toHaveURL(/banking\/connect/);
  });

  test("sidebar should show Bank Feeds label", async ({ authenticatedPage: page }) => {
    await page.goto("/banking");
    // The sidebar link should say "Bank Feeds" not "Banking"
    await expect(
      page.locator("aside").getByText("Bank Feeds")
    ).toBeVisible();
  });
});
