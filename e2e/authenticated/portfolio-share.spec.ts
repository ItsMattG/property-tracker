import { test, expect } from "@playwright/test";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Portfolio Sharing", () => {
  test.setTimeout(120000);

  test("creates a share and views it publicly", async ({ page }) => {
    // Navigate to Portfolio Shares page
    await safeGoto(page, "/reports/share");
    await expect(page.getByRole("heading", { name: "Portfolio Shares" })).toBeVisible();

    // Click Create Share
    await page.getByRole("button", { name: /create share/i }).first().click();

    // Fill in the modal
    await expect(page.getByRole("dialog")).toBeVisible();
    const titleInput = page.getByLabel("Title");
    await titleInput.clear();
    await titleInput.fill("E2E Test Share");

    // Create the share
    await page.getByRole("button", { name: /create share/i }).click();

    // Wait for success — share URL should appear
    await expect(page.getByText("Share Created")).toBeVisible({ timeout: 15_000 });

    // Get the share URL from the readonly input
    const urlInput = page.locator("input[readonly]");
    const shareUrl = await urlInput.inputValue();
    expect(shareUrl).toContain("/share/");

    // Close the modal
    await page.getByRole("button", { name: "Done" }).click();

    // Verify share appears in table
    await expect(page.getByText("E2E Test Share")).toBeVisible();

    // Visit the public share page (no auth needed)
    await page.goto(new URL(shareUrl).pathname);
    await expect(page.getByText("E2E Test Share")).toBeVisible({ timeout: 10_000 });

    // Clean up — revoke the share
    await safeGoto(page, "/reports/share");
    await expect(page.getByText("E2E Test Share")).toBeVisible({ timeout: 10_000 });

    const row = page.getByRole("row").filter({ hasText: "E2E Test Share" });
    await row.getByRole("button", { name: "Share actions" }).click();
    await page.getByRole("menuitem", { name: /revoke/i }).click();

    // Confirm revoke dialog
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /revoke/i }).click();

    // Verify share is removed from table
    await expect(page.getByText("E2E Test Share")).not.toBeVisible({ timeout: 10_000 });
  });
});
