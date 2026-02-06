import { authenticatedTest as test, expect } from "../fixtures/demo-account";

test.describe("Banking Page Audit", () => {
  test.beforeEach(() => {
    test.fixme(!process.env.E2E_DEMO_USER_EMAIL, "Demo account credentials not configured");
  });

  test("captures banking connection states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/banking");
    await page.waitForLoadState("networkidle");
    await captureState("loaded");

    // Check for heading
    const heading = page.getByRole("heading", { name: /banking|accounts/i }).first();
    if (!(await heading.isVisible())) {
      addFinding({
        element: "Banking heading",
        state: "loaded",
        issue: "No banking section heading visible",
        severity: "major",
      });
    }

    // Check for account cards or empty state
    const accountCards = page.locator("article, [data-testid='bank-account-card']");
    const cardCount = await accountCards.count();

    if (cardCount === 0) {
      const emptyState = page.getByText(/no.*(accounts|connections)/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
      } else {
        addFinding({
          element: "Bank accounts",
          state: "loaded",
          issue: "No bank accounts visible and no empty state",
          severity: "critical",
        });
      }
    } else {
      await captureState("with-accounts");

      // Check for sync status indicators
      const syncStatus = page.getByText(/synced|last sync/i).first();
      if (!(await syncStatus.isVisible())) {
        addFinding({
          element: "Sync status",
          state: "loaded",
          issue: "No sync status indicator visible on bank accounts",
          severity: "minor",
        });
      }

      // Check for error state display (from seed data)
      const errorIndicator = page.getByText(/error|failed|disconnected/i).first();
      if (await errorIndicator.isVisible()) {
        await captureState("error-state");
      }

      // Check for stale data warning
      const staleWarning = page.getByText(/stale|outdated|days ago/i);
      if (await staleWarning.isVisible()) {
        await captureState("stale-warning");
      }
    }

    // Check Connect Bank button
    const connectBtn = page.getByRole("button", { name: /connect.*bank|add.*account/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      await page.waitForTimeout(500);

      const dialog = page.locator("[role='dialog']");
      if (await dialog.isVisible()) {
        await captureState("connect-dialog");
        await page.keyboard.press("Escape");
      }
    } else {
      // Check if on connect page instead
      const connectLink = page.getByRole("link", { name: /connect/i });
      if (!(await connectLink.isVisible())) {
        addFinding({
          element: "Connect Bank button",
          state: "loaded",
          issue: "No Connect Bank button or link visible",
          severity: "major",
        });
      }
    }

    // Check reconnect button for disconnected accounts
    const reconnectBtn = page.getByRole("button", { name: /reconnect|reauthorize/i }).first();
    if (await reconnectBtn.isVisible()) {
      await captureState("reconnect-available");
    }

    // Check sync/refresh button
    const syncBtn = page.getByRole("button", { name: /sync|refresh/i }).first();
    if (await syncBtn.isVisible()) {
      await captureState("sync-button");
    }

    // Mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
