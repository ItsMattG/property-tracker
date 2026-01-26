import { test, expect } from "./fixtures/auth";
import { test as publicTest, expect as publicExpect } from "@playwright/test";

publicTest.describe("Feature Request Board (Public)", () => {
  publicTest("should display feature list on public page", async ({ page }) => {
    await page.goto("/feedback");

    await publicExpect(page.getByRole("heading", { name: /feature requests/i })).toBeVisible();
    await publicExpect(page.getByText(/vote on features/i)).toBeVisible();
  });

  publicTest("should have filter controls", async ({ page }) => {
    await page.goto("/feedback");

    // Status filter should be present
    await publicExpect(page.getByRole("combobox").first()).toBeVisible();
  });

  publicTest("should have sort controls", async ({ page }) => {
    await page.goto("/feedback");

    // Sort dropdown should be present (second combobox)
    const comboboxes = page.getByRole("combobox");
    await publicExpect(comboboxes).toHaveCount(2);
  });
});

test.describe("Feature Request Submission", () => {
  test("should show Request Feature button when logged in", async ({ authenticatedPage: page }) => {
    await page.goto("/feedback");

    await expect(page.getByRole("button", { name: /request feature/i })).toBeVisible();
  });

  test("should open feature request modal", async ({ authenticatedPage: page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: /request feature/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/request a feature/i)).toBeVisible();
  });

  test("should have form fields in feature modal", async ({ authenticatedPage: page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: /request feature/i }).click();

    await expect(page.getByLabel(/title/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByLabel(/category/i)).toBeVisible();
  });

  test("should close modal on cancel", async ({ authenticatedPage: page }) => {
    await page.goto("/feedback");

    await page.getByRole("button", { name: /request feature/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("Feedback Button in Sidebar", () => {
  test("should show feedback button in sidebar", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("button", { name: /feedback/i })).toBeVisible();
  });

  test("should open dropdown with options", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();

    await expect(page.getByRole("menuitem", { name: /request feature/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /report bug/i })).toBeVisible();
  });

  test("should open feature request modal from sidebar", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /request feature/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/request a feature/i)).toBeVisible();
  });

  test("should open bug report modal from sidebar", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/report a bug/i)).toBeVisible();
  });
});

test.describe("Bug Report Modal", () => {
  test("should have severity dropdown", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByLabel(/severity/i)).toBeVisible();
  });

  test("should have description field", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByLabel(/what happened/i)).toBeVisible();
  });

  test("should have steps to reproduce field", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: /feedback/i }).click();
    await page.getByRole("menuitem", { name: /report bug/i }).click();

    await expect(page.getByLabel(/steps to reproduce/i)).toBeVisible();
  });
});

test.describe("Settings Navigation", () => {
  test("should have feature requests link in settings", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("link", { name: /feature requests/i })).toBeVisible();
  });

  test("should have bug reports link in settings", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("link", { name: /bug reports/i })).toBeVisible();
  });

  test("should navigate to feature requests settings", async ({ authenticatedPage: page }) => {
    await page.getByRole("link", { name: /feature requests/i }).click();
    await expect(page).toHaveURL(/settings\/feature-requests/);
  });

  test("should navigate to bug reports settings", async ({ authenticatedPage: page }) => {
    await page.getByRole("link", { name: /bug reports/i }).click();
    await expect(page).toHaveURL(/settings\/bug-reports/);
  });
});
