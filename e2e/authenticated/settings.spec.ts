import { test, expect } from "@playwright/test";

test.describe("Settings - Theme Toggle", () => {
  test("can toggle dark mode and it persists after reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to settings
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Verify Appearance section is visible
    await expect(page.getByText("Appearance")).toBeVisible({ timeout: 10_000 });

    // Theme toggle may say "Switch to dark mode" or "Switch to light mode" depending on current state
    const darkModeBtn = page.getByRole("button", { name: /switch to dark mode/i });
    const lightModeBtn = page.getByRole("button", { name: /switch to light mode/i });

    // If already in dark mode, switch to light first to reset
    if (await lightModeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lightModeBtn.click();
      await page.waitForTimeout(500);
    }

    // Now click the dark mode toggle
    await page.getByRole("button", { name: /switch to dark mode/i }).click({ timeout: 10_000 });

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
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /switch to light mode/i }).click();

    const resetTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    // Forest (light) is default — data-theme should be removed
    expect(resetTheme).toBeNull();

    // No page errors
    expect(errors).toEqual([]);
  });
});
