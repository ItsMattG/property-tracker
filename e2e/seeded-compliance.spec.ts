import { test, expect } from "./fixtures/auth";

test.describe("Compliance (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/reports/compliance");
    await page.waitForLoadState("networkidle");
  });

  test("should display compliance page", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /compliance/i })).toBeVisible();
  });

  test("should show compliance items for properties", async ({ authenticatedPage: page }) => {
    // Demo data has compliance records for first property (NSW)
    const complianceItems = [
      /smoke alarm/i,
      /electrical/i,
      /pool/i,
    ];

    let found = false;
    for (const item of complianceItems) {
      if (await page.getByText(item).count() > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("should highlight overdue items", async ({ authenticatedPage: page }) => {
    // Demo data has one overdue compliance record
    await expect(
      page.getByText(/overdue/i).or(page.locator(".text-destructive").first())
    ).toBeVisible();
  });

  test("should filter by property", async ({ authenticatedPage: page }) => {
    // Property filter should be available
    const propertyFilter = page.getByRole("combobox").first();
    if (await propertyFilter.count() > 0) {
      await propertyFilter.click();
      await expect(page.getByText(/paddington/i)).toBeVisible();
    }
  });
});
