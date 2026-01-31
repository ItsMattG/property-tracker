import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display hero section with tagline", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /track smarter/i })).toBeVisible();
    await expect(page.getByText(/tax time sorted/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /start free trial/i }).first()).toBeVisible();
  });

  test("should display navigation with sign in and get started", async ({ page }) => {
    await page.goto("/");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("should display feature cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /automatic bank feeds/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /ato-ready categories/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /your data stays here/i })).toBeVisible();
  });

  test("should display social proof bar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/properties tracked/i)).toBeVisible();
    await expect(page.getByText(/investors/i).first()).toBeVisible();
    await expect(page.getByText(/bank-grade security/i).first()).toBeVisible();
    await expect(page.getByText(/australian/i).first()).toBeVisible();
  });

  test("should display product screenshot panels", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/your portfolio, one screen/i)).toBeVisible();
    await expect(page.getByText(/tax time in minutes/i)).toBeVisible();
    await expect(page.getByText(/transactions that categorize themselves/i)).toBeVisible();
  });

  test("should display benefits list", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/bank transactions import and categorize automatically/i)).toBeVisible();
    await expect(page.getByText(/ato expense codes applied/i)).toBeVisible();
    await expect(page.getByText(/export-ready reports/i)).toBeVisible();
  });

  test("should display pricing cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/simple pricing/i)).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$14")).toBeVisible();
    await expect(page.getByText("$29")).toBeVisible();
    await expect(page.getByText(/most popular/i)).toBeVisible();
  });

  test("should display FAQ section with accordion", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/frequently asked questions/i)).toBeVisible();
    await expect(page.getByText(/is my data safe/i)).toBeVisible();
    await expect(page.getByText(/which banks are supported/i)).toBeVisible();
  });

  test("FAQ accordion expands on click", async ({ page }) => {
    await page.goto("/");

    const trigger = page.getByText(/is my data safe/i);
    await trigger.click();

    await expect(page.getByText(/bank-grade security/i).first()).toBeVisible();
  });

  test("should navigate to sign up when clicking Get Started", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /start free trial/i }).first().click();
    await expect(page).toHaveURL(/sign-up/);
  });

  test("should navigate to sign in when clicking Sign In", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("should display footer with links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /blog/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /changelog/i })).toBeVisible();
  });
});
