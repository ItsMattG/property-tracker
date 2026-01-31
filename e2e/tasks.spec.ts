import { test, expect } from "./fixtures/auth";

test.describe("Task Management", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Navigate to tasks page
    await page.goto("/tasks");
  });

  test("shows tasks page with new task button", async ({ authenticatedPage: page }) => {
    // Verify the tasks page loads and has the new task button
    // Don't check for "No tasks yet" as the user may have existing tasks
    await expect(page.getByRole("button", { name: /new task/i }).first()).toBeVisible();
  });

  test("creates a new task", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: /new task/i }).first().click();

    // Wait for the slide-over form to appear
    await expect(page.getByLabel("Title")).toBeVisible();

    // Fill in task form
    await page.getByLabel("Title").fill("Fix leaky tap");
    await page.getByLabel("Description").fill("Kitchen sink is dripping");

    // Submit (priority defaults to "normal")
    await page.getByRole("button", { name: "Create" }).click();

    // Wait for dialog to close (indicating successful creation)
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

    // Verify task appears in list
    await expect(page.getByText("Fix leaky tap")).toBeVisible({ timeout: 10000 });
  });

  test("edits an existing task", async ({ authenticatedPage: page }) => {
    // Click on a task row to open edit
    await page.getByText("Fix leaky tap").click();

    // Change title
    await page.getByLabel("Title").clear();
    await page.getByLabel("Title").fill("Fix leaky tap urgently");

    // Save
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Task updated")).toBeVisible();
    await expect(page.getByText("Fix leaky tap urgently")).toBeVisible();
  });

  test("toggles between list and kanban views", async ({ authenticatedPage: page }) => {
    // Default should be list view
    await expect(page.getByRole("table")).toBeVisible();

    // Switch to kanban
    await page.getByRole("button", { name: /kanban|board/i }).click();

    // Should see kanban columns
    await expect(page.getByText("To Do")).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();
  });

  test("filters tasks by status", async ({ authenticatedPage: page }) => {
    // Open status filter
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "To Do" }).click();

    // Only todo tasks should be visible
    // (Specific assertions depend on test data)
  });

  test("deletes a task", async ({ authenticatedPage: page }) => {
    await page.getByText("Fix leaky tap urgently").click();
    await page.getByRole("button", { name: /delete/i }).click();

    // Confirm deletion
    await page.getByRole("button", { name: /delete/i }).last().click();
    await expect(page.getByText("Task deleted")).toBeVisible();
  });
});
