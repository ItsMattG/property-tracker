import { test, expect } from "../fixtures/demo-account";

test.describe("Reports Pages Audit", () => {
  const reportPages = [
    { path: "/reports", name: "Reports Hub" },
    { path: "/reports/tax", name: "Tax Report" },
    { path: "/reports/cgt", name: "CGT Report" },
    { path: "/reports/portfolio", name: "Portfolio Report" },
    { path: "/reports/compliance", name: "Compliance Report" },
    { path: "/reports/scenarios", name: "Scenarios" },
    { path: "/reports/tax-position", name: "Tax Position" },
    { path: "/reports/yoy-comparison", name: "YoY Comparison" },
    { path: "/reports/audit-checks", name: "Audit Checks" },
    { path: "/reports/mytax", name: "MyTax Export" },
  ];

  for (const report of reportPages) {
    test(`captures ${report.name} page states`, async ({ audit }) => {
      const { page, addFinding, captureState } = audit;

      await page.goto(report.path);
      await page.waitForLoadState("networkidle");
      await captureState("loaded");

      // Check for heading
      const heading = page.getByRole("heading").first();
      if (!(await heading.isVisible())) {
        addFinding({
          page: report.path,
          element: "Page heading",
          state: "loaded",
          issue: "No heading visible on report page",
          severity: "major",
        });
      }

      // Check for lingering loading states
      const spinners = page.locator(".animate-spin, [data-testid='loading']");
      if (await spinners.first().isVisible()) {
        addFinding({
          page: report.path,
          element: "Loading spinner",
          state: "after-networkidle",
          issue: "Loading spinner still visible after page load",
          severity: "minor",
        });
      }

      // Check for charts (canvas or svg)
      const charts = page.locator("canvas, svg.recharts-surface, [data-testid='chart']");
      if (await charts.first().isVisible()) {
        await captureState("with-charts");
      }

      // Check for data tables
      const tables = page.locator("table");
      if (await tables.first().isVisible()) {
        await captureState("with-table");
      }

      // Check for empty states
      const emptyState = page.getByText(/no data|no results|add.*to get started/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
      }

      // Check for export button
      const exportBtn = page.getByRole("button", { name: /export|download/i });
      if (await exportBtn.isVisible()) {
        await captureState("export-available");
      }

      // Check date range pickers if present
      const dateRange = page.locator("[data-testid='date-range'], button:has-text('date')");
      if (await dateRange.first().isVisible()) {
        await dateRange.first().click();
        await page.waitForTimeout(300);
        await captureState("date-picker-open");
        await page.keyboard.press("Escape");
      }

      // Mobile responsiveness
      await page.setViewportSize({ width: 375, height: 667 });
      await captureState("mobile");
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  }
});
