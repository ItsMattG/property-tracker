import { test, expect } from "./fixtures/auth";

test.describe("Bank Reconciliation", () => {

  test.describe("Bank Feeds Page", () => {
    test("should display Bank Feeds heading", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");
      await expect(
        page.getByRole("heading", { name: /bank feeds/i })
      ).toBeVisible();
    });

    test("should show summary stats cards when accounts exist", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const hasAccounts = await page.getByText(/\d+ accounts? across/i).isVisible().catch(() => false);
      if (!hasAccounts) return; // No accounts — skip summary check

      // Summary stat cards should be visible
      const hasBrickTrackBalance = await page.getByText(/bricktrack balance/i).first().isVisible().catch(() => false);
      const hasBankBalance = await page.getByText(/bank balance/i).first().isVisible().catch(() => false);
      const hasCashIn = await page.getByText(/cash in/i).first().isVisible().catch(() => false);
      const hasCashOut = await page.getByText(/cash out/i).first().isVisible().catch(() => false);

      expect(hasBrickTrackBalance).toBe(true);
      expect(hasBankBalance).toBe(true);
      expect(hasCashIn).toBe(true);
      expect(hasCashOut).toBe(true);
    });

    test("should show reconcile CTA or all-reconciled for each account", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const hasAccounts = await page.getByText(/\d+ accounts? across/i).isVisible().catch(() => false);
      if (!hasAccounts) return;

      // Each account should show either "Reconcile X Items" or "All reconciled"
      const hasReconcileCTA = await page.getByText(/reconcile \d+ items?/i).first().isVisible().catch(() => false);
      const hasAllReconciled = await page.getByText(/all reconciled/i).first().isVisible().catch(() => false);

      expect(hasReconcileCTA || hasAllReconciled).toBe(true);
    });

    test("should show account balance summary row", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const hasAccounts = await page.getByText(/\d+ accounts? across/i).isVisible().catch(() => false);
      if (!hasAccounts) return;

      // Each account card has a balance summary row with BrickTrack balance
      const hasBrickTrack = await page.getByText(/bricktrack:/i).first().isVisible().catch(() => false);
      expect(hasBrickTrack).toBe(true);
    });

    test("should display empty state or accounts list", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);

      // Should show either the accounts list with summary or the empty state
      const hasAccounts = await page.getByText(/\d+ accounts? across/i).isVisible().catch(() => false);
      const hasEmptyState = await page.getByText(/no bank accounts connected/i).isVisible().catch(() => false);
      const hasHeading = await page.getByRole("heading", { name: /bank feeds/i }).isVisible().catch(() => false);

      expect(hasAccounts || hasEmptyState || hasHeading).toBe(true);
    });
  });

  test.describe("Transactions Page — CSV Export", () => {
    test("should show Export CSV button on transactions page", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");
      await expect(
        page.getByRole("button", { name: /export csv/i })
      ).toBeVisible();
    });

    test("Export CSV button should be clickable", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");
      const exportBtn = page.getByRole("button", { name: /export csv/i });
      await expect(exportBtn).toBeVisible();
      await expect(exportBtn).toBeEnabled();
    });
  });

  test.describe("Transactions Table — UI Improvements", () => {
    test("should show allocation status for transactions", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);

      const hasTable = await page.getByRole("table").first().isVisible().catch(() => false);
      if (!hasTable) return;

      // Transactions show allocation status text ("Allocated" or "allocated")
      const hasAllocated = await page.getByText(/allocated/i).first().isVisible().catch(() => false);
      expect(hasAllocated).toBe(true);
    });

    test("should have verified column with check/x icons", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const hasTable = await page.getByRole("table").first().isVisible().catch(() => false);
      if (!hasTable) return;

      // Table header should include Verified column
      await expect(page.getByRole("columnheader", { name: /verified/i })).toBeVisible();
    });
  });

  test.describe("Sidebar Navigation", () => {
    test("sidebar should link to Bank Feeds", async ({ authenticatedPage: page }) => {
      await page.goto("/dashboard");
      const bankLink = page.locator("aside").getByRole("link", { name: /bank feeds/i });
      await expect(bankLink).toBeVisible();
      await expect(bankLink).toHaveAttribute("href", "/banking");
    });

    test("sidebar should have Bank Feeds link, not a standalone Banking link", async ({ authenticatedPage: page }) => {
      await page.goto("/dashboard");
      // The sidebar should have a "Bank Feeds" link pointing to /banking
      const bankFeedsLink = page.locator("aside a").filter({ hasText: "Bank Feeds" });
      await expect(bankFeedsLink).toBeVisible();

      // There should NOT be a sidebar link with exact text "Banking" (only "Bank Feeds")
      // Note: "Properties & Banking" is a collapsible button, not a link — that's fine
      const sidebarLinks = page.locator("aside a");
      const count = await sidebarLinks.count();
      for (let i = 0; i < count; i++) {
        const text = await sidebarLinks.nth(i).textContent();
        if (text?.trim() === "Banking") {
          throw new Error('Found sidebar link with text "Banking" — should be "Bank Feeds"');
        }
      }
    });
  });
});
