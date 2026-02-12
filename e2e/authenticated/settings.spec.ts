import { test, expect } from "@playwright/test";
import { BENIGN_ERROR_PATTERNS, safeGoto } from "../fixtures/test-helpers";

test.describe("Settings - Theme Toggle", () => {
  test("can toggle dark mode and it persists after reload", async ({
    page,
  }) => {
    // Theme persistence relies on server-side session reading the DB theme column;
    // in CI localhost mode the SSR theme hydration doesn't work reliably.
    test.skip(!!process.env.CI, "Theme persistence unreliable in CI localhost mode");
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to settings
    await safeGoto(page, "/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Verify Appearance section is visible
    await expect(page.getByText("Appearance")).toBeVisible({ timeout: 10_000 });

    // Scope to the settings main content area (not the header toggle)
    const main = page.locator("main");

    // Theme toggle may say "Switch to dark mode" or "Switch to light mode" depending on current state
    const lightModeBtn = main.getByRole("button", { name: /switch to light mode/i });

    // If already in dark mode, switch to light first to reset
    if (await lightModeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lightModeBtn.click();
      await page.waitForTimeout(500);
    }

    // Now click the dark mode toggle
    await main.getByRole("button", { name: /switch to dark mode/i }).click({ timeout: 10_000 });

    // Verify data-theme attribute is set on <html>
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(theme).toBe("dark");

    // Reload and verify theme persists (from DB via SSR)
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const themeAfterReload = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(themeAfterReload).toBe("dark");

    // Toggle back to light mode to clean up
    await safeGoto(page, "/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.locator("main").getByRole("button", { name: /switch to light mode/i }).click();

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
