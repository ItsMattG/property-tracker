import { test, expect } from "@playwright/test";
import { featureFlags } from "@/config/feature-flags";
import { safeGoto } from "../fixtures/test-helpers";

test.describe("Email Inbox", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.emails, "emails feature flag is disabled");
  });

  test("global inbox page loads", async ({ page }) => {
    await safeGoto(page, "/emails");

    await expect(page.getByRole("heading", { name: /emails/i })).toBeVisible();
    await expect(
      page.getByText(/forwarded property emails/i)
    ).toBeVisible();
  });

  test("global inbox shows empty state", async ({ page }) => {
    await safeGoto(page, "/emails");

    await expect(page.getByText(/no emails yet/i)).toBeVisible();
    await expect(
      page.getByText(/set up email forwarding/i)
    ).toBeVisible();
  });

  test("global inbox has property and status filters", async ({ page }) => {
    await safeGoto(page, "/emails");

    await expect(page.getByText(/all properties/i)).toBeVisible();
    await expect(page.getByText(/all statuses/i)).toBeVisible();
  });

  test("property email tab loads and shows forwarding address", async ({
    page,
  }) => {
    // Navigate to a property — find first property link
    await safeGoto(page, "/properties");

    const propertyLink = page.locator("a[href^='/properties/']").first();
    if (await propertyLink.isVisible()) {
      await propertyLink.click();

      // Navigate to emails tab
      await safeGoto(page, page.url() + "/emails");

      await expect(page.getByText(/email forwarding/i)).toBeVisible();
      await expect(page.getByText(/forward property emails/i)).toBeVisible();
      await expect(page.getByText(/approved senders/i)).toBeVisible();
    }
  });

  test("sidebar shows emails link", async ({ page }) => {
    await safeGoto(page, "/dashboard");

    await expect(
      page.getByRole("link", { name: /emails/i })
    ).toBeVisible();
  });
});
