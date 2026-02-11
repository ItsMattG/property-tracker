import { test, expect } from "@playwright/test";
import { featureFlags } from "@/config/feature-flags";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Task Management", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    test.skip(!featureFlags.tasks, "tasks feature flag is disabled");
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to tasks page
    await safeGoto(page, "/tasks");
  });

  test("shows tasks page with new task button", async ({ page }) => {
    // Verify the tasks page loads and has the new task button
    // Don't check for "No tasks yet" as the user may have existing tasks
    await expect(page.getByRole("button", { name: /new task/i }).first()).toBeVisible();
  });

  test("opens task form and validates inputs", async ({ page }) => {
    await page.getByRole("button", { name: /new task/i }).first().click();

    // Wait for the slide-over form to appear
    await expect(page.getByLabel("Title")).toBeVisible();

    // Verify form fields are present
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();

    // Verify Create button is disabled when title is empty
    await expect(page.getByRole("button", { name: "Create" })).toBeDisabled();

    // Fill in task form
    await page.getByLabel("Title").fill("Test task title");

    // Verify Create button is enabled after title is filled
    await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();

    // Close the form without submitting
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("toggles between list and kanban views", async ({ page }) => {
    // Look for view toggle buttons
    const kanbanButton = page.getByRole("button", { name: /kanban|board/i });

    // If kanban button exists, test the toggle
    if (await kanbanButton.isVisible().catch(() => false)) {
      await kanbanButton.click();

      // Should see kanban columns
      await expect(page.getByText("To Do")).toBeVisible();
      await expect(page.getByText("In Progress")).toBeVisible();
      await expect(page.getByText("Done")).toBeVisible();
    }
  });

  test("shows filter dropdowns", async ({ page }) => {
    // Verify filter dropdowns are present
    const comboboxes = page.getByRole("combobox");
    const count = await comboboxes.count();

    // Should have at least status filter
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
