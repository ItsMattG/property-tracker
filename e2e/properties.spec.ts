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
});
