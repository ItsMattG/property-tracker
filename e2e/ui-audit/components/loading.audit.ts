import { authenticatedTest as test, expect } from "../fixtures/demo-account";

test.describe("Loading States Audit", () => {
  test.beforeEach(() => {
    test.fixme(!process.env.E2E_DEMO_USER_EMAIL, "Demo account credentials not configured");
  });

  const pagesWithData = [
    "/dashboard",
    "/properties",
    "/transactions",
    "/banking",
    "/reports/tax",
    "/settings/billing",
  ];

  for (const pagePath of pagesWithData) {
    test(`captures loading states on ${pagePath}`, async ({ audit }) => {
      const { page, addFinding, captureState } = audit;

      // Navigate without waiting for network to catch loading states
      await page.goto(pagePath);

      // Capture immediately to catch loading state
      await captureState("initial");

      // Check for skeletons
      const skeletons = page.locator(".animate-pulse, [data-testid='skeleton'], .skeleton");
      const skeletonCount = await skeletons.count();

      if (skeletonCount > 0) {
        await captureState("with-skeletons");
      } else {
        // Check for spinners
        const spinners = page.locator(".animate-spin, [data-testid='loading-spinner']");
        const spinnerVisible = await spinners.first().isVisible().catch(() => false);

        if (!spinnerVisible) {
          // Neither skeleton nor spinner - might be instant load or missing indicator
          addFinding({
            page: pagePath,
            element: "Loading state",
            state: "initial",
            issue: "No visible loading indicator (skeleton or spinner) during load",
            severity: "suggestion",
          });
        }
      }

      // Wait for load to complete
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      await captureState("loaded");

      // Check skeletons are gone after load
      const remainingSkeletons = await skeletons.count();
      if (remainingSkeletons > 0) {
        // Check if they're still visible (not just in DOM)
        let visibleCount = 0;
        for (let i = 0; i < remainingSkeletons; i++) {
          if (await skeletons.nth(i).isVisible().catch(() => false)) {
            visibleCount++;
          }
        }

        if (visibleCount > 0) {
          addFinding({
            page: pagePath,
            element: "Loading skeletons",
            state: "after-load",
            issue: `${visibleCount} skeleton(s) still visible after page load complete`,
            severity: "major",
          });
        }
      }
    });
  }

  test("captures empty states across pages", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // Note: These checks depend on account data state
    // With demo account seeded, we'll see populated states
    // Without data, we'd see empty states

    const emptyStatePages = [
      { path: "/properties", emptyText: /no properties|add your first/i },
      { path: "/transactions", emptyText: /no transactions/i },
      { path: "/banking", emptyText: /no.*(accounts|connections)/i },
    ];

    for (const { path, emptyText } of emptyStatePages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Check for empty state component
      const emptyState = page.locator("[data-testid='empty-state'], .empty-state");
      if (await emptyState.isVisible()) {
        const pageName = path.slice(1);
        await captureState(`${pageName}-empty-state`);

        // Check for call-to-action in empty state
        const ctaButton = emptyState.getByRole("button");
        const ctaLink = emptyState.getByRole("link");

        const hasButton = await ctaButton.isVisible().catch(() => false);
        const hasLink = await ctaLink.isVisible().catch(() => false);

        if (!hasButton && !hasLink) {
          addFinding({
            page: path,
            element: "Empty state",
            state: "displayed",
            issue: "Empty state has no call-to-action button or link",
            severity: "suggestion",
          });
        }
      } else {
        // Check if page shows expected empty text
        const emptyMessage = page.getByText(emptyText);
        if (await emptyMessage.isVisible()) {
          const pageName = path.slice(1);
          await captureState(`${pageName}-empty-message`);
        }
      }
    }
  });

  test("captures error states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // Navigate to a page that might show errors
    await page.goto("/banking");
    await page.waitForLoadState("networkidle");

    // Check for error indicators (from seeded error state bank accounts)
    const errorIndicators = page.locator(
      "[data-testid='error'], .text-destructive, [role='alert']"
    );

    if (await errorIndicators.first().isVisible()) {
      await captureState("error-state");

      // Check error has retry action
      const retryBtn = page.getByRole("button", { name: /retry|try again|reconnect/i });
      if (!(await retryBtn.isVisible())) {
        addFinding({
          element: "Error state",
          state: "displayed",
          issue: "Error state has no retry/reconnect action",
          severity: "minor",
        });
      }
    }

    // Check for toast/notification errors
    const toasts = page.locator("[data-sonner-toast], .toast");
    if (await toasts.first().isVisible()) {
      await captureState("toast-notification");
    }
  });
});
