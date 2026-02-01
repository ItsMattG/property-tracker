import { authenticatedTest as test, expect } from "../fixtures/demo-account";

test.describe("Properties Page Audit", () => {
  test("captures properties list states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/properties");
    await page.waitForLoadState("networkidle");
    await captureState("loaded");

    // Check heading
    const heading = page.getByRole("heading", { name: /properties/i }).first();
    if (!(await heading.isVisible())) {
      addFinding({
        element: "Properties heading",
        state: "loaded",
        issue: "Properties heading not visible",
        severity: "major",
      });
    }

    // Check for property cards or empty state
    const propertyCards = page.locator("[data-testid='property-card'], .property-card, article");
    const cardCount = await propertyCards.count();

    if (cardCount === 0) {
      // Check for empty state
      const emptyState = page.getByText(/no properties|add your first/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
      } else {
        addFinding({
          element: "Properties list",
          state: "loaded",
          issue: "No properties visible and no empty state",
          severity: "critical",
        });
      }
    } else {
      await captureState("with-properties");

      // Click first property to see detail
      const firstProperty = propertyCards.first();
      await firstProperty.click();
      await page.waitForURL(/\/properties\/[^/]+$/);
      await page.waitForLoadState("networkidle");
      await captureState("property-detail");

      // Check property detail elements
      const addressHeading = page.getByRole("heading").first();
      if (!(await addressHeading.isVisible())) {
        addFinding({
          element: "Property address",
          state: "detail",
          issue: "Property address heading not visible",
          severity: "major",
        });
      }

      // Check tabs if present
      const tabs = page.getByRole("tablist");
      if (await tabs.isVisible()) {
        const tabButtons = await tabs.getByRole("tab").all();
        for (let i = 0; i < Math.min(tabButtons.length, 4); i++) {
          const tab = tabButtons[i];
          const tabName = await tab.textContent();
          await tab.click();
          await page.waitForTimeout(300);
          await captureState(`tab-${tabName?.toLowerCase().replace(/\s+/g, "-") || i}`);
        }
      }
    }

    // Mobile responsiveness
    await page.goto("/properties");
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("captures property creation flow", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/properties/new");
    await page.waitForLoadState("networkidle");
    await captureState("new-property-form");

    // Check form is visible
    const form = page.locator("form");
    if (!(await form.isVisible())) {
      addFinding({
        element: "New property form",
        state: "loaded",
        issue: "New property form not visible",
        severity: "critical",
      });
      return;
    }

    // Check for address field
    const addressInput = page.getByLabel(/address/i);
    if (!(await addressInput.isVisible())) {
      addFinding({
        element: "Address field",
        state: "loaded",
        issue: "Address field not visible or not properly labeled",
        severity: "major",
      });
    }

    // Test form validation
    const submitBtn = page.getByRole("button", { name: /save|create|add/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      await captureState("validation-errors");

      // Check for validation messages
      const errorMessages = page.locator("[role='alert'], .text-destructive, .text-red");
      const errorCount = await errorMessages.count();
      if (errorCount === 0) {
        addFinding({
          element: "Form validation",
          state: "submitted-empty",
          issue: "No validation errors shown when submitting empty form",
          severity: "major",
        });
      }
    }

    // Mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("new-property-mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
