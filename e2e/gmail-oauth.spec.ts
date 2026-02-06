import { test, expect } from "./fixtures/auth";
import { featureFlags } from "@/config/feature-flags";

test.describe("Gmail OAuth Integration", () => {
  test.beforeEach(() => {
    test.skip(!featureFlags.emailConnections, "emailConnections feature flag is disabled");
  });

  test("email connections page loads and shows connect button", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings/email-connections");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check page title
    await expect(
      page.getByRole("heading", { name: /email connections/i })
    ).toBeVisible();

    // Check for description
    await expect(
      page.getByText(/connect your email accounts/i)
    ).toBeVisible();

    // Check for Connect Gmail button
    const connectButton = page.getByRole("link", { name: /connect gmail/i });
    await expect(connectButton).toBeVisible();

    // Check for Outlook coming soon
    await expect(page.getByText(/outlook.*coming soon/i)).toBeVisible();

    // Check for Approved Senders section
    await expect(
      page.getByRole("heading", { name: /approved senders/i })
    ).toBeVisible();
  });

  test("shows warning when no approved senders", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings/email-connections");
    await page.waitForLoadState("networkidle");

    // Should show alert about adding approved senders first
    await expect(
      page.getByText(/add approved senders.*before connecting/i)
    ).toBeVisible();
  });

  test("connect gmail button navigates to OAuth endpoint", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings/email-connections");

    // Wait for tRPC data to load
    await page.waitForSelector("[data-testid='connect-gmail-btn'], a[href='/api/auth/gmail']", {
      timeout: 10000,
    }).catch(() => {});

    // Check the Connect Gmail button has correct href
    const connectButton = page.getByRole("link", { name: /connect gmail/i });
    await expect(connectButton).toBeVisible({ timeout: 10000 });

    const href = await connectButton.getAttribute("href");
    expect(href).toBe("/api/auth/gmail");

    // Verify button is properly styled and accessible
    await expect(connectButton).toHaveAttribute("href", "/api/auth/gmail");
  });

  test("oauth endpoint returns redirect response", async ({
    authenticatedPage: page,
  }) => {
    // Use Playwright's request API to check the redirect response
    const context = page.context();

    // Intercept the response to the OAuth endpoint
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/auth/gmail"),
      { timeout: 15000 }
    );

    // Navigate to the OAuth endpoint (this will cause a redirect)
    page.goto("/api/auth/gmail").catch(() => {
      // Expected - the page will navigate away from localhost
    });

    const response = await responsePromise;

    // The endpoint should return a 307 redirect
    expect(response.status()).toBe(307);

    // Check the location header points to Google OAuth
    const locationHeader = response.headers()["location"];
    expect(locationHeader).toBeTruthy();
    expect(locationHeader).toContain("accounts.google.com");
    expect(locationHeader).toContain("client_id=");
    expect(locationHeader).toContain("redirect_uri=");
    expect(locationHeader).toContain("scope=");
  });
});
