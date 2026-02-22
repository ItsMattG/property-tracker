import { test, expect } from "@playwright/test";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Portfolio Sharing", () => {
  test.setTimeout(120000);

  test("creates a share and views it publicly", async ({ page }) => {
    // Clean up any leftover "E2E Test Share" from previous failed runs
    await safeGoto(page, "/reports/share");
    await expect(page.getByRole("heading", { name: "Portfolio Shares" })).toBeVisible({ timeout: 15000 });

    // Revoke any existing E2E Test Shares to avoid strict mode violations
    let leftoverRow = page.getByRole("row").filter({ hasText: "E2E Test Share" });
    while (await leftoverRow.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await leftoverRow.first().getByRole("button", { name: "Share actions" }).click();
      await page.getByRole("menuitem", { name: /revoke/i }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole("button", { name: /revoke/i }).click();
      await page.waitForTimeout(1000);
      // Re-query the row since the DOM has changed
      leftoverRow = page.getByRole("row").filter({ hasText: "E2E Test Share" });
    }

    // Click Create Share
    await page.getByRole("button", { name: /create share/i }).first().click();

    // Fill in the modal
    await expect(page.getByRole("dialog")).toBeVisible();
    const titleInput = page.getByLabel("Title");
    await titleInput.clear();
    await titleInput.fill("E2E Test Share");

    // Create the share
    await page.getByRole("button", { name: /create share/i }).click();

    // Wait for success dialog — use dialog heading to avoid matching the toast notification
    await expect(
      page.getByRole("heading", { name: "Share Created" })
    ).toBeVisible({ timeout: 30_000 });

    // Get the share URL from the readonly input
    const urlInput = page.locator("input[readonly]");
    const shareUrl = await urlInput.inputValue();
    expect(shareUrl).toContain("/share/");

    // Close the modal
    await page.getByRole("button", { name: "Done" }).click();

    // Verify share appears in table (use first() since there's exactly one now)
    await expect(page.getByText("E2E Test Share").first()).toBeVisible();

    // Visit the public share page (no auth needed)
    await page.goto(new URL(shareUrl).pathname);
    // Public page has the title in the heading — use role to avoid matching <title> tag
    await expect(
      page.getByRole("heading", { name: "E2E Test Share" })
    ).toBeVisible({ timeout: 10_000 });

    // Clean up — revoke the share
    await safeGoto(page, "/reports/share");
    await expect(page.getByText("E2E Test Share").first()).toBeVisible({ timeout: 10_000 });

    const row = page.getByRole("row").filter({ hasText: "E2E Test Share" });
    await row.first().getByRole("button", { name: "Share actions" }).click();
    await page.getByRole("menuitem", { name: /revoke/i }).click();

    // Confirm revoke dialog
    const revokeDialog = page.getByRole("alertdialog");
    await expect(revokeDialog).toBeVisible();
    await revokeDialog.getByRole("button", { name: /revoke/i }).click();

    // Verify share is removed from table
    await expect(page.getByText("E2E Test Share")).not.toBeVisible({ timeout: 10_000 });
  });
});
