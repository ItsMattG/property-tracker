import { test, expect } from "./fixtures/auth";
import { seedDecoyData, cleanupDecoyData, getDecoyIds } from "./fixtures/decoy-data";
import { closeDbConnection } from "./fixtures/db";

test.describe("Cross-Tenant Access Protection", () => {
  let decoyIds: { userId: string; propertyId: string; transactionId: string | null };

  test.beforeAll(async () => {
    decoyIds = await seedDecoyData();
  });

  test.afterAll(async () => {
    await cleanupDecoyData();
    await closeDbConnection();
  });

  test("cannot access another user's property via direct URL", async ({ authenticatedPage: page }) => {
    // Navigate to decoy property
    await page.goto(`/properties/${decoyIds.propertyId}`);

    // Should show error or redirect, not the property details
    // Check for "not found" message or redirect to properties list
    await page.waitForLoadState("networkidle");
    const content = await page.content();
    const url = page.url();

    const notFoundOrRedirect =
      content.toLowerCase().includes("not found") ||
      content.toLowerCase().includes("property not found") ||
      (url.includes("/properties") && !url.includes(decoyIds.propertyId));

    expect(notFoundOrRedirect).toBe(true);
  });

  test("cannot see another user's transactions", async ({ authenticatedPage: page }) => {
    // Navigate to transactions with decoy property filter
    await page.goto(`/transactions?propertyId=${decoyIds.propertyId}`);
    await page.waitForLoadState("networkidle");

    // Should show empty list or no results
    // The decoy transaction description should NOT appear
    const content = await page.content();
    expect(content).not.toContain("Decoy Transaction");
    expect(content).not.toContain("SHOULD NOT BE VISIBLE");
  });

  test("cannot edit another user's property", async ({ authenticatedPage: page }) => {
    // Try to access edit page for decoy property
    await page.goto(`/properties/${decoyIds.propertyId}/edit`);
    await page.waitForLoadState("networkidle");

    // Should show error or redirect
    const content = await page.content();
    const url = page.url();

    const notFoundOrRedirect =
      content.toLowerCase().includes("not found") ||
      content.toLowerCase().includes("property not found") ||
      !url.includes(decoyIds.propertyId);

    expect(notFoundOrRedirect).toBe(true);
  });

  test("API rejects access to another user's property", async ({ authenticatedPage: page, request }) => {
    // First visit the app to get authenticated session
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Get cookies for API request
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Try to fetch decoy property via tRPC
    const response = await request.get(
      `/api/trpc/property.get?input=${encodeURIComponent(JSON.stringify({ id: decoyIds.propertyId }))}`,
      {
        headers: {
          Cookie: cookieHeader,
        },
      }
    );

    // Should return error, not the property
    const body = await response.json();
    expect(body.error || body.result?.error).toBeTruthy();
  });
});
