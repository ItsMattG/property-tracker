import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility - Authenticated Pages", () => {
  test("dashboard should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".driver-active-element") // driver.js tour injects invalid ARIA attrs
      .exclude(".driver-popover") // driver.js popover
      .exclude(".recharts-responsive-container") // recharts SVGs have known a11y issues
      .disableRules(["color-contrast"]) // chart/gradient elements can trigger false positives
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("properties page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/properties");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".driver-active-element")
      .exclude(".driver-popover")
      .disableRules(["color-contrast"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("transactions page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".driver-active-element") // driver.js tour injects invalid ARIA attrs
      .exclude(".driver-popover")
      .disableRules(["color-contrast"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("tax report page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/tax-report");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("settings page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });
});
