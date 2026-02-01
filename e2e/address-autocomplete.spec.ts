import { test, expect } from "./fixtures/auth";

test.describe("Address Autocomplete", () => {
  test.describe("Property Form", () => {
    test("should display address autocomplete input on new property page", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/properties/new");

      // Should have the address field with autocomplete placeholder
      const addressInput = page.getByPlaceholder("Start typing an address...");
      await expect(addressInput).toBeVisible();
    });

    test("should allow typing in address field", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/properties/new");

      const addressInput = page.getByPlaceholder("Start typing an address...");
      await addressInput.fill("123 Test Street");

      await expect(addressInput).toHaveValue("123 Test Street");
    });

    test("should show Google Places autocomplete dropdown when typing", async ({
      authenticatedPage: page,
    }) => {
      // Skip if no API key configured
      test.skip(
        !process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
        "Skipping - NEXT_PUBLIC_GOOGLE_PLACES_API_KEY not configured"
      );

      await page.goto("/properties/new");

      const addressInput = page.getByPlaceholder("Start typing an address...");
      await addressInput.click();
      await addressInput.fill("42 Wallaby Way Sydney");

      // Wait for Google Places dropdown to appear
      // Google Places creates a pac-container div for suggestions
      const autocompleteDropdown = page.locator(".pac-container");
      await expect(autocompleteDropdown).toBeVisible({ timeout: 5000 });
    });

    test("should auto-fill all address fields when selecting suggestion", async ({
      authenticatedPage: page,
    }) => {
      // Skip if no API key configured
      test.skip(
        !process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
        "Skipping - NEXT_PUBLIC_GOOGLE_PLACES_API_KEY not configured"
      );

      await page.goto("/properties/new");

      const addressInput = page.getByPlaceholder("Start typing an address...");
      await addressInput.click();
      await addressInput.fill("1 Martin Place Sydney");

      // Wait for and click first suggestion
      const firstSuggestion = page.locator(".pac-container .pac-item").first();
      await firstSuggestion.waitFor({ state: "visible", timeout: 5000 });
      await firstSuggestion.click();

      // Verify other fields got populated
      // Wait a moment for state to update
      await page.waitForTimeout(500);

      const suburbInput = page.getByPlaceholder("Sydney");
      const postcodeInput = page.getByPlaceholder("2000");

      // At least suburb should be filled (Sydney CBD area)
      await expect(suburbInput).not.toHaveValue("");
      await expect(postcodeInput).not.toHaveValue("");
    });

    test("should allow manual entry of all fields as fallback", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/properties/new");

      // Fill address field manually
      const addressInput = page.getByPlaceholder("Start typing an address...");
      await addressInput.fill("123 Test Street");

      // Fill other fields manually
      await page.getByPlaceholder("Sydney").fill("Brisbane");
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "QLD" }).click();
      await page.getByPlaceholder("2000").fill("4000");

      // Verify all values are set
      await expect(addressInput).toHaveValue("123 Test Street");
      await expect(page.getByPlaceholder("Sydney")).toHaveValue("Brisbane");
      await expect(page.getByPlaceholder("2000")).toHaveValue("4000");
    });
  });

  test.describe("Onboarding Wizard", () => {
    test("should display address autocomplete in onboarding", async ({
      authenticatedPage: page,
    }) => {
      // Navigate to dashboard which may show onboarding
      await page.goto("/dashboard");

      // If onboarding wizard is visible, check for address field
      const wizardVisible = await page
        .getByText("Add Your First Property")
        .isVisible()
        .catch(() => false);

      if (wizardVisible) {
        const addressInput = page.getByPlaceholder("Start typing an address...");
        await expect(addressInput).toBeVisible();
      } else {
        // Onboarding already completed, skip this test
        test.skip();
      }
    });
  });
});
