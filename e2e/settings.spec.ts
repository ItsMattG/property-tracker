import { test, expect } from "./fixtures/auth";

test.describe("Settings - Theme Selector", () => {
  test("can select a theme and it persists after reload", async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to settings
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Verify Appearance section is visible
    await expect(page.getByText("Appearance")).toBeVisible();

    // Click the Ocean theme card
    await page.getByRole("button", { name: /Ocean/i }).click();

    // Verify data-theme attribute is set on <html>
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(theme).toBe("ocean");

    // Reload and verify theme persists (from DB via SSR)
    await page.reload();
    await page.waitForLoadState("networkidle");

    const themeAfterReload = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    expect(themeAfterReload).toBe("ocean");

    // Reset back to forest (default) to clean up
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Forest/i }).click();

    const resetTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
    // Forest is default — data-theme should be removed
    expect(resetTheme).toBeNull();

    // No page errors
    expect(errors).toEqual([]);
  });
});
