import { test, expect } from "@playwright/test";
import { seedDecoyData, cleanupDecoyData } from "../fixtures/decoy-data";
import { closeDbConnection } from "../fixtures/db";

test.describe("Cross-Tenant Access Protection", () => {
  let decoyIds: { userId: string; propertyId: string; transactionId: string | null } | null = null;
  let seedingFailed = false;

  test.beforeAll(async () => {
    try {
      decoyIds = await seedDecoyData();
    } catch (error) {
      // If pool exhaustion, mark for skipping rather than failing
      // Check both error.message and error.cause.message (drizzle wraps postgres errors)
      const errorMessage = (error as Error).message || "";
      const causeMessage = ((error as Error).cause as Error)?.message || "";
      const isPoolError =
        errorMessage.includes("MaxClientsInSessionMode") ||
        causeMessage.includes("MaxClientsInSessionMode");

      if (isPoolError) {
        console.warn("Skipping cross-tenant tests due to database pool exhaustion");
        seedingFailed = true;
      } else {
        throw error;
      }
    }
  });

  test.afterAll(async () => {
    if (!seedingFailed) {
      await cleanupDecoyData();
    }
    await closeDbConnection();
  });

  test.beforeEach(async () => {
    // Skip tests if seeding failed
    test.skip(seedingFailed, "Database pool exhausted - skipping cross-tenant tests");
  });

  test("cannot access another user's property via direct URL", async ({ page }) => {
    // decoyIds is guaranteed non-null here due to beforeEach skip
    const ids = decoyIds!;

    // Navigate to decoy property
    await page.goto(`/properties/${ids.propertyId}`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for the page to settle (tRPC data needs time to load and show "not found")
    await page.waitForTimeout(5000);

    const content = await page.content();
    const contentLower = content.toLowerCase();
    const url = page.url();

    const notFoundOrRedirect =
      contentLower.includes("not found") ||
      contentLower.includes("error") ||
      contentLower.includes("unauthorized") ||
      contentLower.includes("forbidden") ||
      contentLower.includes("does not exist") ||
      contentLower.includes("no property") ||
      (url.includes("/properties") && !url.includes(ids.propertyId)) ||
      url.includes("/dashboard");

    expect(notFoundOrRedirect).toBe(true);
  });

  test("cannot see another user's transactions", async ({ page }) => {
    const ids = decoyIds!;

    // Navigate to transactions with decoy property filter
    await page.goto(`/transactions?propertyId=${ids.propertyId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Should show empty list or no results
    const content = await page.content();
    expect(content).not.toContain("Decoy Transaction");
    expect(content).not.toContain("SHOULD NOT BE VISIBLE");
  });

  test("cannot edit another user's property", async ({ page }) => {
    const ids = decoyIds!;

    // Try to access edit page for decoy property
    await page.goto(`/properties/${ids.propertyId}/edit`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    // Should show error or redirect
    const content = await page.content();
    const contentLower = content.toLowerCase();
    const url = page.url();

    const notFoundOrRedirect =
      contentLower.includes("not found") ||
      contentLower.includes("error") ||
      contentLower.includes("unauthorized") ||
      contentLower.includes("forbidden") ||
      !url.includes(ids.propertyId);

    expect(notFoundOrRedirect).toBe(true);
  });

  test("API rejects access to another user's property", async ({ page, request }) => {
    const ids = decoyIds!;

    // First visit the app to get authenticated session
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Get cookies for API request
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Try to fetch decoy property via tRPC
    const response = await request.get(
      `/api/trpc/property.get?input=${encodeURIComponent(JSON.stringify({ id: ids.propertyId }))}`,
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
