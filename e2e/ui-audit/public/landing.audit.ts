import { test, expect } from "../fixtures/demo-account";

test.describe("Landing Page Audit", () => {
  test("captures all landing page states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // Navigate to landing (no auth needed)
    await page.goto("/");
    await captureState("loaded");

    // Check hero section
    const heroHeading = page.getByRole("heading", { name: /track smarter/i });
    if (!(await heroHeading.isVisible())) {
      addFinding({
        element: "Hero heading",
        state: "loaded",
        issue: "Hero heading not visible",
        severity: "critical",
      });
    }

    // Check CTA buttons
    const ctaButton = page.getByRole("link", { name: /start free trial/i }).first();
    if (await ctaButton.isVisible()) {
      await ctaButton.hover();
      await captureState("cta-hover");
    }

    // Check navigation
    const signInLink = page.getByRole("link", { name: /sign in/i }).first();
    if (!(await signInLink.isVisible())) {
      addFinding({
        element: "Sign In link",
        state: "loaded",
        issue: "Sign In link not visible in navigation",
        severity: "major",
      });
    }

    // Check mobile navigation (hamburger menu)
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");

    const mobileMenuButton = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await page.waitForTimeout(300);
      await captureState("mobile-menu-open");
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Check FAQ accordion
    const faqTrigger = page.getByText(/is my data safe/i);
    if (await faqTrigger.isVisible()) {
      await faqTrigger.click();
      await page.waitForTimeout(200);
      await captureState("faq-expanded");
    }

    // Check pricing cards
    const pricingSection = page.getByText(/simple pricing/i);
    if (await pricingSection.isVisible()) {
      await pricingSection.scrollIntoViewIfNeeded();
      await captureState("pricing-section");
    }

    // Check footer links
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await captureState("footer");

    const footerLinks = ["Blog", "Privacy Policy", "Terms of Service", "Changelog"];
    for (const linkText of footerLinks) {
      const link = footer.getByRole("link", { name: new RegExp(linkText, "i") });
      if (!(await link.isVisible())) {
        addFinding({
          element: `Footer ${linkText} link`,
          state: "loaded",
          issue: `${linkText} link not visible in footer`,
          severity: "minor",
        });
      }
    }
  });
});
