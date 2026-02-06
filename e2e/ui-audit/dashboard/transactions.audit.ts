import { authenticatedTest as test, expect } from "../fixtures/demo-account";

test.describe("Transactions Page Audit", () => {
  test.beforeEach(() => {
    test.fixme(!process.env.E2E_DEMO_USER_EMAIL, "Demo account credentials not configured");
  });

  test("captures transactions list states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
    await captureState("loaded");

    // Check for table or list
    const table = page.locator("table");
    const tableVisible = await table.isVisible();

    if (!tableVisible) {
      const emptyState = page.getByText(/no transactions/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
      } else {
        addFinding({
          element: "Transactions table",
          state: "loaded",
          issue: "No transactions table or empty state visible",
          severity: "critical",
        });
      }
      return;
    }

    // Check table headers
    const headers = table.locator("th");
    const headerCount = await headers.count();
    if (headerCount < 3) {
      addFinding({
        element: "Table headers",
        state: "loaded",
        issue: `Only ${headerCount} table headers, expected at least 3`,
        severity: "minor",
      });
    }

    // Check for filters
    const filterButton = page.getByRole("button", { name: /filter/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);
      await captureState("filters-open");
      await page.keyboard.press("Escape");
    }

    // Check for search
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(500);
      await captureState("search-active");
      await searchInput.clear();
    }

    // Check pagination if present
    const pagination = page.locator("nav[aria-label*='pagination' i], .pagination");
    if (await pagination.isVisible()) {
      await captureState("with-pagination");
    }

    // Test bulk actions if available
    const selectAllCheckbox = page.locator("th input[type='checkbox']").first();
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.click();
      await page.waitForTimeout(300);
      await captureState("bulk-selected");

      const bulkActions = page.getByRole("button", { name: /categorize|delete|assign/i });
      if (await bulkActions.first().isVisible()) {
        await captureState("bulk-actions-visible");
      }

      // Uncheck
      await selectAllCheckbox.click();
    }

    // Mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("captures transaction review flow", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/transactions/review");
    await page.waitForLoadState("networkidle");
    await captureState("review-loaded");

    // Check for uncategorized transactions queue
    const uncategorizedSection = page.getByText(/uncategorized|review/i);
    if (await uncategorizedSection.isVisible()) {
      await captureState("uncategorized-queue");
    }

    // Check categorization controls
    const categorySelect = page.locator("select, [role='combobox']").first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await page.waitForTimeout(300);
      await captureState("category-dropdown");
      await page.keyboard.press("Escape");
    }

    // Mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("review-mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
