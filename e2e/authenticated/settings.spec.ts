import { test, expect } from "@playwright/test";
import { BENIGN_ERROR_PATTERNS, safeGoto, dismissTourIfVisible } from "../fixtures/test-helpers";

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

    // Dismiss onboarding tour — it duplicates buttons causing strict mode violations
    await dismissTourIfVisible(page);

    // Verify Appearance section is visible
    await expect(page.getByText("Appearance")).toBeVisible({ timeout: 10_000 });

    // Theme toggle may say "Switch to dark mode" or "Switch to light mode" depending on current state
    const lightModeBtn = page.getByRole("button", { name: /switch to light mode/i }).first();

    // If already in dark mode, switch to light first to reset
    if (await lightModeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lightModeBtn.click();
      await page.waitForTimeout(1000);
    }

    // Mock the tRPC user.setTheme mutation so onError doesn't revert the theme.
    // In CI the mutation can fail (no DB session), causing applyTheme to be reverted.
    await page.route('**/api/trpc/user.setTheme*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { theme: "dark" } } }]),
      })
    );

    // Click dark mode toggle — applyTheme() synchronously sets data-theme + localStorage
    await page.getByRole("button", { name: /switch to dark mode/i }).first().click({ timeout: 10_000 });

    // Verify data-theme is set (applyTheme sets it synchronously, mock prevents revert)
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "dark",
      { timeout: 5_000 }
    );

    // Reload and verify theme persists (inline script reads localStorage)
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "dark",
      { timeout: 10_000 }
    );

    // Clean up: reset to light mode
    await page.evaluate(() => {
      localStorage.setItem("bricktrack-theme", "forest");
      document.documentElement.removeAttribute("data-theme");
    });

    const resetTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(resetTheme).toBeNull();

    // No page errors (filter out benign ones like ResizeObserver, hydration, etc.)
    const realErrors = errors.filter((msg) => !BENIGN_ERROR_PATTERNS.some((p) => p.test(msg)));
    expect(realErrors).toEqual([]);
  });
});
