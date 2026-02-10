import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility - Public Pages", () => {
  test("landing page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("blog listing page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("changelog page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/changelog");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("privacy policy page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test("terms of service page should have no critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/terms");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });
});
