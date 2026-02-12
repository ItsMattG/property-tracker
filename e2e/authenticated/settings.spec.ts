import { test, expect } from "@playwright/test";
import { BENIGN_ERROR_PATTERNS, safeGoto } from "../fixtures/test-helpers";

test.describe("Settings - Theme Toggle", () => {
  test("can toggle dark mode and it persists after reload", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to settings
    await safeGoto(page, "/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Verify Appearance section is visible
    await expect(page.getByText("Appearance")).toBeVisible({ timeout: 10_000 });

    // Theme toggle may say "Switch to dark mode" or "Switch to light mode" depending on current state
    const lightModeBtn = page.getByRole("button", { name: /switch to light mode/i });

    // If already in dark mode, switch to light first to reset
    if (await lightModeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lightModeBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click dark mode toggle and wait for the tRPC mutation to complete
    // (prevents onError from reverting localStorage before reload)
    const themeResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc') && resp.url().includes('user.setTheme'),
      { timeout: 10_000 }
    );
    await page.getByRole("button", { name: /switch to dark mode/i }).click({ timeout: 10_000 });
    await themeResponsePromise;

    // Verify data-theme attribute is set on <html>
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(theme).toBe("dark");

    // Reload and verify theme persists (inline script reads localStorage)
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "dark",
      { timeout: 10_000 }
    );

    // Toggle back to light mode to clean up
    const resetResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/trpc') && resp.url().includes('user.setTheme'),
      { timeout: 10_000 }
    );
    await page.getByRole("button", { name: /switch to light mode/i }).click();
    await resetResponsePromise;

    const resetTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    // Forest (light) is default — data-theme should be removed
    expect(resetTheme).toBeNull();

    // No page errors (filter out benign ones like ResizeObserver, hydration, etc.)
    const realErrors = errors.filter((msg) => !BENIGN_ERROR_PATTERNS.some((p) => p.test(msg)));
    expect(realErrors).toEqual([]);
  });
});
