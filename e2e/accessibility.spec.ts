import { test, expect } from "@playwright/test";
import { test as authTest, expect as authExpect } from "./fixtures/auth";
import AxeBuilder from "@axe-core/playwright";

// Test accessibility on public pages (no auth required)
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

// Test accessibility on authenticated pages (using authenticatedPage fixture)
authTest.describe("Accessibility - Authenticated Pages", () => {
  authTest("dashboard should have no critical accessibility violations", async ({
    authenticatedPage: page,
  }) => {
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    authExpect(results.violations).toEqual([]);
  });

  authTest("properties page should have no critical accessibility violations", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/properties");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    authExpect(results.violations).toEqual([]);
  });

  authTest("transactions page should have no critical accessibility violations", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    authExpect(results.violations).toEqual([]);
  });

  authTest("tax report page should have no critical accessibility violations", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/tax-report");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    authExpect(results.violations).toEqual([]);
  });

  authTest("settings page should have no critical accessibility violations", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log("Accessibility violations:", JSON.stringify(results.violations, null, 2));
    }

    authExpect(results.violations).toEqual([]);
  });
});
