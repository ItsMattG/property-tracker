import { test, expect } from "../fixtures/auth";

test.describe("Cash Flow Calendar", () => {
  test("page loads with header, controls, and chart", async ({
    authenticatedPage: page,
  }) => {
    // Track page errors
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      // Ignore known benign errors
      const benign = [
        "Minified React error #418",
        "Minified React error #423",
        "hydrat",
      ];
      if (!benign.some((b) => error.message.includes(b))) {
        pageErrors.push(error);
      }
    });

    await page.goto("/cash-flow");
    await page.waitForLoadState("networkidle");

    // Page header
    await expect(page.locator("main").getByRole("heading", { name: "Cash Flow" })).toBeVisible();

    // Controls should be visible
    await expect(page.getByText("All properties")).toBeVisible();
    await expect(page.getByRole("button", { name: "3M" })).toBeVisible();
    await expect(page.getByRole("button", { name: "6M" })).toBeVisible();
    await expect(page.getByRole("button", { name: "12M" })).toBeVisible();

    // Balance projection card should be visible
    await expect(page.getByText("Balance Projection")).toBeVisible();

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test("can toggle between calendar and list views", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/cash-flow");
    await page.waitForLoadState("networkidle");

    // Default is calendar view - check for day headers (exact match to avoid "Mon" in "Commonwealth")
    await expect(page.getByText("Mon", { exact: true })).toBeVisible();
    await expect(page.getByText("Tue", { exact: true })).toBeVisible();

    // Switch to list view
    await page.getByRole("button", { name: "List view" }).click();

    // Calendar day headers should not be visible
    await expect(page.getByText("Mon", { exact: true })).not.toBeVisible();
  });

  test("can change time horizon", async ({ authenticatedPage: page }) => {
    await page.goto("/cash-flow");
    await page.waitForLoadState("networkidle");

    // Click 12M
    await page.getByRole("button", { name: "12M" }).click();

    // Page should still be functional (no crash)
    await expect(page.getByText("Balance Projection")).toBeVisible();
  });

  test("sidebar shows Cash Flow nav item", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    // Cash Flow is in the Reports & Tax nav group — wait for sidebar to fully render
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    // Wait for sidebar hydration by checking a known top-level link exists
    await expect(
      sidebar.getByRole("link", { name: /dashboard/i })
    ).toBeVisible({ timeout: 15000 });

    // Cash Flow link — use href selector as fallback for accessible name matching
    const navLink = sidebar.locator('a[href="/cash-flow"]');
    await expect(navLink).toBeVisible({ timeout: 15000 });

    // Click it and verify navigation
    await navLink.click();
    await page.waitForURL("**/cash-flow", { timeout: 15000 });
    await expect(page.locator("main").getByRole("heading", { name: "Cash Flow" })).toBeVisible({ timeout: 10000 });
  });
});
