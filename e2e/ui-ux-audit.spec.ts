import { test, expect } from "./fixtures/auth";

/**
 * Comprehensive UI/UX audit test
 * Navigates through major pages and interacts with UI elements
 * to identify potential issues
 */

test.describe("UI/UX Comprehensive Audit", () => {
  test("Dashboard - loads and displays key elements", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check main heading exists
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

    // Check stats cards are visible
    await expect(page.getByText("Properties")).toBeVisible();
    await expect(page.getByText("Transactions")).toBeVisible();

    // Take screenshot for manual review
    await page.screenshot({ path: "test-results/ui-audit/dashboard.png", fullPage: true });
  });

  test("Properties page - list and interactions", async ({ authenticatedPage: page }) => {
    await page.goto("/properties");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /properties/i }).first()).toBeVisible();

    // Check Add Property button exists
    const addButton = page.getByRole("button", { name: /add property/i });
    await expect(addButton).toBeVisible();

    // Click to open dialog
    await addButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Close dialog
    await page.keyboard.press("Escape");

    await page.screenshot({ path: "test-results/ui-audit/properties.png", fullPage: true });
  });

  test("Transactions page - filters and table", async ({ authenticatedPage: page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /transactions/i }).first()).toBeVisible();

    // Check filter controls exist
    await expect(page.getByText(/all transactions/i)).toBeVisible();

    // Check view toggle buttons
    await expect(page.getByRole("button", { name: /reconciliation/i })).toBeVisible();

    await page.screenshot({ path: "test-results/ui-audit/transactions.png", fullPage: true });
  });

  test("Loans page - list and add dialog", async ({ authenticatedPage: page }) => {
    await page.goto("/loans");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /loans/i }).first()).toBeVisible();

    // Check Add Loan button
    const addButton = page.getByRole("button", { name: /add loan/i });
    await expect(addButton).toBeVisible();

    // Click to open dialog
    await addButton.click();
    await page.waitForTimeout(500);

    // Check dialog opened
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible()) {
      await page.screenshot({ path: "test-results/ui-audit/loans-dialog.png" });
      await page.keyboard.press("Escape");
    }

    await page.screenshot({ path: "test-results/ui-audit/loans.png", fullPage: true });
  });

  test("Portfolio page - metrics and charts", async ({ authenticatedPage: page }) => {
    await page.goto("/portfolio");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /portfolio/i }).first()).toBeVisible();

    // Check toolbar controls
    await expect(page.getByRole("button", { name: /monthly/i })).toBeVisible();

    await page.screenshot({ path: "test-results/ui-audit/portfolio.png", fullPage: true });
  });

  test("Alerts page - list and dismiss", async ({ authenticatedPage: page }) => {
    await page.goto("/alerts");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /alerts/i }).first()).toBeVisible();

    await page.screenshot({ path: "test-results/ui-audit/alerts.png", fullPage: true });
  });

  test("Reports page - navigation", async ({ authenticatedPage: page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /reports/i }).first()).toBeVisible();

    await page.screenshot({ path: "test-results/ui-audit/reports.png", fullPage: true });
  });

  test("Banking page - connections", async ({ authenticatedPage: page }) => {
    await page.goto("/banking");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /banking/i }).first()).toBeVisible();

    await page.screenshot({ path: "test-results/ui-audit/banking.png", fullPage: true });
  });

  test("Settings - Notifications page", async ({ authenticatedPage: page }) => {
    await page.goto("/settings/notifications");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/ui-audit/settings-notifications.png", fullPage: true });
  });

  test("Settings - Team page", async ({ authenticatedPage: page }) => {
    await page.goto("/settings/team");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/ui-audit/settings-team.png", fullPage: true });
  });

  test("Tasks page - list and interactions", async ({ authenticatedPage: page }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /tasks/i }).first()).toBeVisible();

    // Check Add Task button
    const addButton = page.getByRole("button", { name: /add task/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
    }

    await page.screenshot({ path: "test-results/ui-audit/tasks.png", fullPage: true });
  });

  test("Review page - categorization suggestions", async ({ authenticatedPage: page }) => {
    await page.goto("/transactions/review");
    await page.waitForLoadState("networkidle");

    // Check page heading
    await expect(page.getByRole("heading", { name: /review/i }).first()).toBeVisible();

    await page.screenshot({ path: "test-results/ui-audit/review.png", fullPage: true });
  });

  test("Sidebar navigation - all links accessible", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check sidebar exists
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Check key navigation items
    const navItems = [
      "Dashboard",
      "Properties",
      "Transactions",
      "Portfolio",
      "Banking",
      "Loans",
      "Alerts",
      "Reports",
    ];

    for (const item of navItems) {
      await expect(sidebar.getByRole("link", { name: item })).toBeVisible();
    }

    await page.screenshot({ path: "test-results/ui-audit/sidebar.png" });
  });

  test("Mobile responsiveness - viewport tests", async ({ authenticatedPage: page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/ui-audit/mobile-dashboard.png", fullPage: true });

    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/ui-audit/mobile-transactions.png", fullPage: true });

    await page.goto("/portfolio");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/ui-audit/mobile-portfolio.png", fullPage: true });
  });

  test("Error handling - check toast visibility", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check that toast container exists (Sonner)
    const toastContainer = page.locator("[data-sonner-toaster]");
    // Toast container should exist even if empty
    await expect(toastContainer).toBeAttached();
  });

  test("Keyboard navigation - focus states", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Tab through interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
    }

    // Capture focused state
    await page.screenshot({ path: "test-results/ui-audit/keyboard-focus.png" });
  });

  test("Dialog accessibility - escape key closes", async ({ authenticatedPage: page }) => {
    await page.goto("/properties");
    await page.waitForLoadState("networkidle");

    // Open add property dialog
    const addButton = page.getByRole("button", { name: /add property/i });
    await addButton.click();

    await expect(page.getByRole("dialog")).toBeVisible();

    // Press Escape to close
    await page.keyboard.press("Escape");

    // Dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
