import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display hero section with tagline", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /your spreadsheet/i })).toBeVisible();
    await expect(page.getByText(/automated/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /start free trial/i })).toBeVisible();
  });

  test("should display navigation with sign in and get started", async ({ page }) => {
    await page.goto("/");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("should display feature cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/australian bank feeds/i)).toBeVisible();
    await expect(page.getByText(/ato tax categories/i)).toBeVisible();
    await expect(page.getByText(/bank-grade security/i)).toBeVisible();
  });

  test("should display social proof bar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/properties tracked/i)).toBeVisible();
    await expect(page.getByText(/investors/i)).toBeVisible();
    await expect(page.getByText(/bank-grade encryption/i)).toBeVisible();
    await expect(page.getByText(/australian owned/i)).toBeVisible();
  });

  test("should display product screenshot panels", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/see your whole portfolio at a glance/i)).toBeVisible();
    await expect(page.getByText(/tax-ready reports in one click/i)).toBeVisible();
    await expect(page.getByText(/automatic bank transaction import/i)).toBeVisible();
  });

  test("should display benefits list", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/automatic transaction import/i)).toBeVisible();
    await expect(page.getByText(/smart categorization/i)).toBeVisible();
    await expect(page.getByText(/one-click export/i)).toBeVisible();
  });

  test("should display pricing cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/simple, transparent pricing/i)).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$14")).toBeVisible();
    await expect(page.getByText("$29")).toBeVisible();
    await expect(page.getByText(/most popular/i)).toBeVisible();
  });

  test("should display FAQ section with accordion", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/frequently asked questions/i)).toBeVisible();
    await expect(page.getByText(/is my financial data secure/i)).toBeVisible();
    await expect(page.getByText(/which australian banks/i)).toBeVisible();
  });

  test("FAQ accordion expands on click", async ({ page }) => {
    await page.goto("/");

    const trigger = page.getByText(/is my financial data secure/i);
    await trigger.click();

    await expect(page.getByText(/aes-256 encryption/i)).toBeVisible();
  });

  test("should navigate to sign up when clicking Get Started", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /start free trial/i }).click();
    await expect(page).toHaveURL(/sign-up/);
  });

  test("should navigate to sign in when clicking Sign In", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("should display footer with links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /changelog/i })).toBeVisible();
  });
});
