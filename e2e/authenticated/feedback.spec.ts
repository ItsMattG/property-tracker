import { test, expect } from "@playwright/test";
import { featureFlags } from "../../src/config/feature-flags";

test.describe("Feature Request Submission", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.helpMenu, "Help menu feature flag is disabled");
  });

  test("should show Request Feature button when logged in", async ({ page }) => {
    await page.goto("/feedback");

    await expect(page.getByRole("button", { name: /request feature/i })).toBeVisible();
  });

  test("should open feature request modal", async ({ page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: /request feature/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/request a feature/i)).toBeVisible();
  });

  test("should have form fields in feature modal", async ({ page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: /request feature/i }).click();

    await expect(page.getByLabel(/title/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByLabel(/category/i)).toBeVisible();
  });

  test("should close modal on cancel", async ({ page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: /request feature/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("Feedback Button in Header", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.helpMenu, "Help menu feature flag is disabled");
  });

  test("should show feedback button in header", async ({ page }) => {
    const header = page.locator("header");
    await expect(header.getByRole("button", { name: /feedback/i })).toBeVisible();
  });

  test("should open dropdown with options", async ({ page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();

    await expect(page.getByRole("menuitem", { name: /request feature/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /report bug/i })).toBeVisible();
  });

  test("should open feature request modal from sidebar", async ({ page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /request feature/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/request a feature/i)).toBeVisible();
  });

  test("should open bug report modal from sidebar", async ({ page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/report a bug/i)).toBeVisible();
  });
});

test.describe("Bug Report Modal", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.helpMenu, "Help menu feature flag is disabled");
  });

  test("should have severity dropdown", async ({ page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByLabel(/severity/i)).toBeVisible();
  });

  test("should have description field", async ({ page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByLabel(/what happened/i)).toBeVisible();
  });

  test("should have steps to reproduce field", async ({ page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByLabel(/steps to reproduce/i)).toBeVisible();
  });
});

test.describe("Settings Navigation", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.featureRequests, "Feature requests feature flag is disabled");
  });

  test("should have feature requests link in settings", async ({ page }) => {
    await expect(page.getByRole("link", { name: /feature requests/i })).toBeVisible();
  });

  test("should navigate to feature requests settings", async ({ page }) => {
    await page.getByRole("link", { name: /feature requests/i }).click();
    await expect(page).toHaveURL(/settings\/feature-requests/);
  });
});
