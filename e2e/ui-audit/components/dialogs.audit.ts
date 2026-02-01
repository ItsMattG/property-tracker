import { test, expect } from "../fixtures/demo-account";

test.describe("Dialog Components Audit", () => {
  test("captures confirm dialog states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // Navigate to properties to find delete functionality
    await page.goto("/properties");
    await page.waitForLoadState("networkidle");

    // Try to find a delete button
    const deleteBtn = page.getByRole("button", { name: /delete/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(300);

      const dialog = page.locator("[role='alertdialog'], [role='dialog']");
      if (await dialog.isVisible()) {
        await captureState("confirm-dialog");

        // Check for confirmation message
        const confirmText = dialog.getByText(/are you sure|confirm|cannot be undone/i);
        if (!(await confirmText.isVisible())) {
          addFinding({
            element: "Confirm dialog",
            state: "open",
            issue: "No confirmation message in delete dialog",
            severity: "major",
          });
        }

        // Check for cancel button
        const cancelBtn = dialog.getByRole("button", { name: /cancel|no|close/i });
        if (!(await cancelBtn.isVisible())) {
          addFinding({
            element: "Confirm dialog",
            state: "open",
            issue: "No cancel button in confirm dialog",
            severity: "critical",
          });
        }

        // Check escape key closes dialog
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);

        if (await dialog.isVisible()) {
          addFinding({
            element: "Confirm dialog",
            state: "escape-pressed",
            issue: "Dialog does not close with Escape key",
            severity: "minor",
          });
        }
      }
    }
  });

  test("captures form dialog states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for "Add" buttons that open form dialogs
    const addBtns = page.getByRole("button", { name: /add|create|new/i });
    const btnCount = await addBtns.count();

    for (let i = 0; i < Math.min(btnCount, 3); i++) {
      const btn = addBtns.nth(i);
      if (await btn.isVisible()) {
        const btnText = (await btn.textContent()) || `button-${i}`;
        await btn.click();
        await page.waitForTimeout(500);

        const dialog = page.locator("[role='dialog']");
        if (await dialog.isVisible()) {
          await captureState(`form-dialog-${i}`);

          // Check dialog has close button or X
          const closeBtn = dialog
            .locator("button[aria-label*='close' i], button:has(svg.lucide-x)")
            .first();
          if (!(await closeBtn.isVisible())) {
            // Check for text-based close
            const textClose = dialog.getByRole("button", { name: /close|cancel/i });
            if (!(await textClose.isVisible())) {
              addFinding({
                element: `Form dialog (${btnText.trim()})`,
                state: "open",
                issue: "No visible close button in dialog",
                severity: "minor",
              });
            }
          }

          // Close dialog
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);

          if (await dialog.isVisible()) {
            // Try clicking close button
            const anyCloseBtn = dialog.getByRole("button", { name: /close|cancel/i }).first();
            if (await anyCloseBtn.isVisible()) {
              await anyCloseBtn.click();
            }
          }
        }
      }
    }
  });

  test("captures sheet/drawer dialog states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");

    // Look for filter button that might open a sheet
    const filterBtn = page.getByRole("button", { name: /filter/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);

      const sheet = page.locator("[data-state='open'][role='dialog'], .sheet-content");
      if (await sheet.isVisible()) {
        await captureState("sheet-open");

        // Check it can be dismissed
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);

        if (await sheet.isVisible()) {
          addFinding({
            element: "Filter sheet",
            state: "escape-pressed",
            issue: "Sheet does not close with Escape key",
            severity: "minor",
          });
        }
      }
    }

    // Check mobile sidebar sheet
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    const menuBtn = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(300);
      await captureState("mobile-sidebar-sheet");
      await page.keyboard.press("Escape");
    }

    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
