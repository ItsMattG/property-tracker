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
    await expect(page.getByRole("heading", { name: "Cash Flow" })).toBeVisible();

    // Controls should be visible
    await expect(page.getByText("All properties")).toBeVisible();
    await expect(page.getByText("3M")).toBeVisible();
    await expect(page.getByText("6M")).toBeVisible();
    await expect(page.getByText("12M")).toBeVisible();

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

    // Default is calendar view - check for day headers
    await expect(page.getByText("Mon")).toBeVisible();
    await expect(page.getByText("Tue")).toBeVisible();

    // Switch to list view
    await page.getByTitle("List view").click();

    // Calendar day headers should not be visible
    await expect(page.getByText("Mon")).not.toBeVisible();
  });

  test("can change time horizon", async ({ authenticatedPage: page }) => {
    await page.goto("/cash-flow");
    await page.waitForLoadState("networkidle");

    // Click 12M
    await page.getByText("12M").click();

    // Page should still be functional (no crash)
    await expect(page.getByText("Balance Projection")).toBeVisible();
  });

  test("sidebar shows Cash Flow nav item", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Cash Flow should be in sidebar
    const navLink = page.getByRole("link", { name: "Cash Flow" });
    await expect(navLink).toBeVisible();

    // Click it and verify navigation
    await navLink.click();
    await page.waitForURL("**/cash-flow");
    await expect(page.getByRole("heading", { name: "Cash Flow" })).toBeVisible();
  });
});
