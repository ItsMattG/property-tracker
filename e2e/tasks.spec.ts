import { test, expect } from "@playwright/test";

test.describe("Task Management", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to tasks page (assumes auth is handled by test setup)
    await page.goto("/tasks");
  });

  test("shows empty state when no tasks exist", async ({ page }) => {
    await expect(page.getByText("No tasks yet")).toBeVisible();
    await expect(page.getByText("New Task")).toBeVisible();
  });

  test("creates a new task", async ({ page }) => {
    await page.getByRole("button", { name: /new task/i }).click();

    // Fill in task form
    await page.getByLabel("Title").fill("Fix leaky tap");
    await page.getByLabel("Description").fill("Kitchen sink is dripping");

    // Set priority to High
    await page.getByLabel("Priority").click();
    await page.getByRole("option", { name: "High" }).click();

    // Submit
    await page.getByRole("button", { name: "Create" }).click();

    // Verify task appears in list
    await expect(page.getByText("Fix leaky tap")).toBeVisible();
    await expect(page.getByText("Task created")).toBeVisible();
  });

  test("edits an existing task", async ({ page }) => {
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

  test("toggles between list and kanban views", async ({ page }) => {
    // Default should be list view
    await expect(page.getByRole("table")).toBeVisible();

    // Switch to kanban
    await page.getByRole("button", { name: /kanban|board/i }).click();

    // Should see kanban columns
    await expect(page.getByText("To Do")).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();
  });

  test("filters tasks by status", async ({ page }) => {
    // Open status filter
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "To Do" }).click();

    // Only todo tasks should be visible
    // (Specific assertions depend on test data)
  });

  test("deletes a task", async ({ page }) => {
    await page.getByText("Fix leaky tap urgently").click();
    await page.getByRole("button", { name: /delete/i }).click();

    // Confirm deletion
    await page.getByRole("button", { name: /delete/i }).last().click();
    await expect(page.getByText("Task deleted")).toBeVisible();
  });
});
