import { test, expect } from "./fixtures/auth";

test.describe("Banking", () => {
  test("should display banking page with heading", async ({ authenticatedPage: page }) => {
    await page.goto("/banking");
    await expect(page.getByRole("heading", { name: /banking/i })).toBeVisible();
  });

  test("should display banking description", async ({ authenticatedPage: page }) => {
    await page.goto("/banking");
    await expect(page.getByText(/manage your connected bank accounts/i)).toBeVisible();
  });

  test("should navigate to connect page directly", async ({ authenticatedPage: page }) => {
    await page.goto("/banking/connect");
    await expect(page).toHaveURL(/banking\/connect/);
  });
});
