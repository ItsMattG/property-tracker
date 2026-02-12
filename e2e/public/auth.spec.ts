import { test, expect } from "@playwright/test";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Authentication", () => {
  test.describe("Unauthenticated Users", () => {
    test("should redirect /dashboard to sign-in", async ({ page }) => {
      await safeGoto(page, "/dashboard");
      await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
    });

    test("should redirect /properties to sign-in", async ({ page }) => {
      await safeGoto(page, "/properties");
      await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
    });

    test("should redirect /transactions to sign-in", async ({ page }) => {
      await safeGoto(page, "/transactions");
      await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
    });

    test("should redirect /banking to sign-in", async ({ page }) => {
      await safeGoto(page, "/banking");
      await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
    });

    test("should redirect /export to sign-in", async ({ page }) => {
      await safeGoto(page, "/export");
      await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
    });
  });

  test.describe("Sign In Page", () => {
    test("should display sign-in form", async ({ page }) => {
      await safeGoto(page, "/sign-in");
      await expect(page).toHaveURL(/sign-in/);
      // Wait for form to load
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    });

    test("should have link to sign up", async ({ page }) => {
      await safeGoto(page, "/sign-in");
      await expect(page.getByLabel("Email")).toBeVisible();
      // Custom sign-in page includes a sign-up link
      await expect(page.getByText(/sign up/i)).toBeVisible();
    });
  });

  test.describe("Sign Up Page", () => {
    test("should display sign-up form", async ({ page }) => {
      await safeGoto(page, "/sign-up");
      await expect(page).toHaveURL(/sign-up/);
      // Wait for form to load
      await expect(page.getByLabel("Name")).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    });

    test("should have link to sign in", async ({ page }) => {
      await safeGoto(page, "/sign-up");
      await expect(page.getByLabel("Email")).toBeVisible();
      // Custom sign-up page includes a sign-in link
      await expect(page.getByText(/sign in/i)).toBeVisible();
    });
  });
});
