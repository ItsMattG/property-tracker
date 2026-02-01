import { test, expect } from "../fixtures/demo-account";

test.describe("Settings Pages Audit", () => {
  const settingsPages = [
    { path: "/settings/billing", name: "Billing" },
    { path: "/settings/team", name: "Team" },
    { path: "/settings/integrations", name: "Integrations" },
    { path: "/settings/notifications", name: "Notifications" },
    { path: "/settings/bug-reports", name: "Bug Reports" },
    { path: "/settings/feature-requests", name: "Feature Requests" },
    { path: "/settings/mobile", name: "Mobile" },
    { path: "/settings/refinance-alerts", name: "Refinance Alerts" },
    { path: "/settings/advisors", name: "Advisors" },
    { path: "/settings/referrals", name: "Referrals" },
    { path: "/settings/support", name: "Support" },
  ];

  for (const settings of settingsPages) {
    test(`captures ${settings.name} settings states`, async ({ audit }) => {
      const { page, addFinding, captureState } = audit;

      await page.goto(settings.path);
      await page.waitForLoadState("networkidle");
      await captureState("loaded");

      // Check for heading
      const heading = page.getByRole("heading").first();
      if (!(await heading.isVisible())) {
        addFinding({
          page: settings.path,
          element: "Page heading",
          state: "loaded",
          issue: "No heading visible on settings page",
          severity: "major",
        });
      }

      // Check for forms
      const forms = page.locator("form");
      if (await forms.first().isVisible()) {
        await captureState("with-form");

        // Check form has labels
        const inputs = forms.first().locator("input, select, textarea");
        const inputCount = await inputs.count();
        const labels = forms.first().locator("label");
        const labelCount = await labels.count();

        if (inputCount > 0 && labelCount < inputCount) {
          addFinding({
            page: settings.path,
            element: "Form labels",
            state: "loaded",
            issue: `${inputCount} inputs but only ${labelCount} labels`,
            severity: "minor",
          });
        }
      }

      // Check for toggle switches
      const toggles = page.locator("[role='switch'], input[type='checkbox']");
      if (await toggles.first().isVisible()) {
        await captureState("with-toggles");
      }

      // Check for save/update button
      const saveBtn = page.getByRole("button", { name: /save|update/i });
      if (await saveBtn.isVisible()) {
        await captureState("save-available");
      }

      // Check for danger zone
      const dangerZone = page.getByText(/danger|delete|disconnect/i);
      if (await dangerZone.isVisible()) {
        await captureState("danger-zone");
      }

      // Mobile responsiveness
      await page.setViewportSize({ width: 375, height: 667 });
      await captureState("mobile");
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  }

  test("captures billing subscription flow", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    await captureState("billing-loaded");

    // Check for current plan display
    const planDisplay = page.getByText(/free|pro|business|current plan/i);
    if (!(await planDisplay.isVisible())) {
      addFinding({
        element: "Current plan",
        state: "loaded",
        issue: "Current plan not visible on billing page",
        severity: "major",
      });
    }

    // Check for upgrade button
    const upgradeBtn = page.getByRole("button", { name: /upgrade|change plan/i });
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await page.waitForTimeout(500);

      const dialog = page.locator("[role='dialog']");
      if (await dialog.isVisible()) {
        await captureState("upgrade-modal");
        await page.keyboard.press("Escape");
      }
    }

    // Check for billing history section
    const billingHistory = page.getByText(/billing history|invoices|payments/i);
    if (await billingHistory.isVisible()) {
      await captureState("billing-history");
    }
  });
});
