import { test, expect } from "../fixtures/demo-account";

test.describe("Legal Pages Audit", () => {
  test("captures privacy policy states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/privacy");
    await captureState("loaded");

    // Check heading
    const heading = page.getByRole("heading", { name: /privacy policy/i });
    if (!(await heading.isVisible())) {
      addFinding({
        element: "Privacy heading",
        state: "loaded",
        issue: "Privacy Policy heading not visible",
        severity: "critical",
      });
    }

    // Check navigation back to home
    const homeLink = page.getByRole("link", { name: /bricktrack/i }).first();
    if (!(await homeLink.isVisible())) {
      addFinding({
        element: "Home link",
        state: "loaded",
        issue: "No link back to home page",
        severity: "minor",
      });
    }

    // Check mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");

    // Check prose content is readable
    const content = page.locator(".prose");
    if (await content.isVisible()) {
      const box = await content.boundingBox();
      if (box && box.width > 375) {
        addFinding({
          element: "Privacy content",
          state: "mobile",
          issue: "Content overflows viewport on mobile",
          severity: "major",
        });
      }
    }

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("captures terms of service states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/terms");
    await captureState("loaded");

    // Check heading
    const heading = page.getByRole("heading", { name: /terms of service/i });
    if (!(await heading.isVisible())) {
      addFinding({
        element: "Terms heading",
        state: "loaded",
        issue: "Terms of Service heading not visible",
        severity: "critical",
      });
    }

    // Check for required sections
    const requiredSections = [
      "Acceptance of Terms",
      "Description of Service",
      "Limitation of Liability",
    ];

    for (const section of requiredSections) {
      const sectionHeading = page.getByRole("heading", { name: new RegExp(section, "i") });
      if (!(await sectionHeading.isVisible())) {
        addFinding({
          element: `Section: ${section}`,
          state: "loaded",
          issue: `Required section "${section}" not visible`,
          severity: "major",
        });
      }
    }

    // Check mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");

    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
