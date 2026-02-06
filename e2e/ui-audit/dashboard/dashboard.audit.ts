import { authenticatedTest as test, expect } from "../fixtures/demo-account";

test.describe("Dashboard Audit", () => {
  test.beforeEach(() => {
    test.fixme(!process.env.E2E_DEMO_USER_EMAIL, "Demo account credentials not configured");
  });

  test("captures all dashboard states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await captureState("loaded");

    // Check welcome message or main heading
    const welcomeHeading = page.getByRole("heading").first();
    if (!(await welcomeHeading.isVisible())) {
      addFinding({
        element: "Dashboard heading",
        state: "loaded",
        issue: "No heading visible on dashboard",
        severity: "major",
      });
    }

    // Check stats cards
    const statsText = page.getByText(/properties|transactions/i).first();
    if (!(await statsText.isVisible())) {
      addFinding({
        element: "Stats section",
        state: "loaded",
        issue: "No stats visible on dashboard",
        severity: "major",
      });
    }

    // Check sidebar navigation
    const sidebar = page.locator("aside");
    if (await sidebar.isVisible()) {
      await captureState("with-sidebar");

      const navItems = ["Dashboard", "Properties", "Transactions", "Banking", "Export"];
      for (const item of navItems) {
        const link = sidebar.getByRole("link", { name: new RegExp(item, "i") });
        if (!(await link.isVisible())) {
          addFinding({
            element: `Sidebar ${item} link`,
            state: "loaded",
            issue: `${item} link not visible in sidebar`,
            severity: "major",
          });
        }
      }
    } else {
      addFinding({
        element: "Sidebar",
        state: "loaded",
        issue: "Sidebar navigation not visible",
        severity: "critical",
      });
    }

    // Check for loading skeletons (should be gone after networkidle)
    const skeletons = page.locator(".animate-pulse, [data-testid='skeleton']");
    const skeletonCount = await skeletons.count();
    if (skeletonCount > 0) {
      addFinding({
        element: "Loading skeletons",
        state: "after-load",
        issue: `${skeletonCount} skeleton(s) still visible after page load`,
        severity: "major",
      });
    }

    // Check mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");

    // Look for mobile menu trigger
    const mobileMenuTrigger = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await mobileMenuTrigger.isVisible()) {
      await mobileMenuTrigger.click();
      await page.waitForTimeout(300);
      await captureState("mobile-sidebar-open");
      await page.keyboard.press("Escape");
    }

    await page.setViewportSize({ width: 1280, height: 720 });

    // Test quick action buttons if they exist
    const addPropertyBtn = page.getByRole("button", { name: /add property/i });
    if (await addPropertyBtn.isVisible()) {
      await addPropertyBtn.click();
      await page.waitForTimeout(500);

      const dialog = page.locator("[role='dialog']");
      if (await dialog.isVisible()) {
        await captureState("add-property-dialog");
        await page.keyboard.press("Escape");
      }
    }
  });
});
