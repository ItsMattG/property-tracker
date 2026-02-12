import { test, expect } from "@playwright/test";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Feature Request Board (Public)", () => {
  test("should display feature list on public page", async ({ page }) => {
    await safeGoto(page, "/feedback");

    await expect(page.getByRole("heading", { name: /feature requests/i })).toBeVisible();
    await expect(page.getByText(/vote on features/i)).toBeVisible();
  });

  test("should have filter controls", async ({ page }) => {
    await safeGoto(page, "/feedback");

    // Status filter should be present
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("should have sort controls", async ({ page }) => {
    await safeGoto(page, "/feedback");

    // Sort dropdown should be present (second combobox)
    const comboboxes = page.getByRole("combobox");
    await expect(comboboxes).toHaveCount(2);
  });
});
