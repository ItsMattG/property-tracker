import { test, expect } from "./fixtures/auth";

test.describe("Settings - Theme Toggle", () => {
  test("can toggle dark mode and it persists after reload", async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to settings
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Verify Appearance section is visible
    await expect(page.getByText("Appearance")).toBeVisible();

    // Click the dark mode toggle
    await page.getByRole("button", { name: /switch to dark mode/i }).click();

    // Verify data-theme attribute is set on <html>
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(theme).toBe("dark");

    // Reload and verify theme persists (from DB via SSR)
    await page.reload();
    await page.waitForLoadState("networkidle");

    const themeAfterReload = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(themeAfterReload).toBe("dark");

    // Toggle back to light mode to clean up
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
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
