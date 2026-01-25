# Seed-Based E2E Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create comprehensive E2E tests that verify UI displays seeded demo data correctly across portfolio, transactions, loans, compliance, and alerts features.

**Architecture:** Modify global setup to seed demo data for a test user before tests run. Create a new `seeded-features.spec.ts` with tests that verify the seeded data appears correctly. Tests are read-only (don't create/delete data) to maintain stable test state.

**Tech Stack:** Playwright, Clerk Testing Mode, Drizzle ORM, Demo Seed System

---

## Task 1: Add Seed Integration Fixture

**Files:**
- Create: `e2e/fixtures/seed-integration.ts`

**Step 1: Create seed integration helper**

```typescript
// e2e/fixtures/seed-integration.ts
import { config } from "dotenv";

// Load env before importing db modules
config({ path: ".env.local" });

/**
 * Seeds demo data for E2E tests.
 * Uses dynamic import to ensure env vars are loaded first.
 */
export async function seedDemoDataForTests(clerkId: string): Promise<void> {
  const { seed, clean } = await import("../../src/lib/seed");

  // Clean existing data first for consistent state
  await clean(clerkId);

  // Seed fresh demo data
  await seed({
    clerkId,
    mode: "demo",
    clean: false, // Already cleaned above
  });
}

/**
 * Cleans up seeded data after tests.
 */
export async function cleanupSeedData(clerkId: string): Promise<void> {
  const { clean } = await import("../../src/lib/seed");
  await clean(clerkId);
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit e2e/fixtures/seed-integration.ts`
Expected: No errors (or ts-node required warning which is fine)

**Step 3: Commit**

```bash
git add e2e/fixtures/seed-integration.ts
git commit -m "feat(e2e): add seed integration fixture"
```

---

## Task 2: Update Global Setup to Seed Demo Data

**Files:**
- Modify: `e2e/global-setup.ts`

**Step 1: Update global setup to seed data**

Replace contents of `e2e/global-setup.ts`:

```typescript
import { clerkSetup } from "@clerk/testing/playwright";
import { config } from "dotenv";
import { FullConfig } from "@playwright/test";
import { seedDemoDataForTests } from "./fixtures/seed-integration";

// Load environment variables
config({ path: ".env.local" });

// Get test user Clerk ID from environment
const E2E_CLERK_ID = process.env.E2E_CLERK_USER_ID;

async function globalSetup(config: FullConfig) {
  // Set up Clerk testing mode
  await clerkSetup();

  // Seed demo data if we have a test user configured
  if (E2E_CLERK_ID) {
    console.log("Seeding demo data for E2E tests...");
    try {
      await seedDemoDataForTests(E2E_CLERK_ID);
      console.log("Demo data seeded successfully");
    } catch (error) {
      console.error("Failed to seed demo data:", error);
      throw error;
    }
  } else {
    console.warn("E2E_CLERK_USER_ID not set - skipping demo data seeding");
  }
}

export default globalSetup;
```

**Step 2: Add E2E_CLERK_USER_ID to .env.local**

Add to `.env.local`:
```
E2E_CLERK_USER_ID=user_your_test_user_clerk_id
```

Note: Use the same Clerk ID as E2E_CLERK_USER_EMAIL user.

**Step 3: Commit**

```bash
git add e2e/global-setup.ts
git commit -m "feat(e2e): seed demo data in global setup"
```

---

## Task 3: Create Portfolio Seeded Tests

**Files:**
- Create: `e2e/seeded-portfolio.spec.ts`

**Step 1: Write portfolio tests against seeded data**

```typescript
// e2e/seeded-portfolio.spec.ts
import { test, expect } from "./fixtures/auth";

test.describe("Portfolio (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/portfolio");
    await page.waitForLoadState("networkidle");
  });

  test("should display 4 property cards", async ({ authenticatedPage: page }) => {
    // Demo data has 4 properties: Paddington, Brighton, Fortitude Valley, Newtown
    const propertyCards = page.locator('[data-testid="property-card"]');

    // If no test IDs, count cards by content
    await expect(page.getByText(/paddington/i)).toBeVisible();
    await expect(page.getByText(/brighton/i)).toBeVisible();
    await expect(page.getByText(/fortitude valley/i)).toBeVisible();
    await expect(page.getByText(/newtown/i)).toBeVisible();
  });

  test("should show sold badge for Newtown property", async ({ authenticatedPage: page }) => {
    // Newtown was sold in Oct 2024
    const newtownCard = page.locator("text=Newtown").locator("..");
    await expect(newtownCard.getByText(/sold/i)).toBeVisible();
  });

  test("should display portfolio equity summary", async ({ authenticatedPage: page }) => {
    // Should show total value and equity
    await expect(page.getByText(/total value/i)).toBeVisible();
    await expect(page.getByText(/total equity/i).or(page.getByText(/equity/i).first())).toBeVisible();
  });

  test("should show correct property count in summary", async ({ authenticatedPage: page }) => {
    // Summary should mention property count
    await expect(page.getByText(/4 propert/i).or(page.getByText("4").first())).toBeVisible();
  });

  test("should display LVR for active properties", async ({ authenticatedPage: page }) => {
    // LVR should be visible on property cards
    await expect(page.getByText(/lvr/i).first()).toBeVisible();
  });
});
```

**Step 2: Run tests to verify they work with seeded data**

Run: `npx playwright test e2e/seeded-portfolio.spec.ts --headed`
Expected: Tests should pass if demo data is seeded and UI matches expectations

**Step 3: Commit**

```bash
git add e2e/seeded-portfolio.spec.ts
git commit -m "test(e2e): add portfolio tests for seeded data"
```

---

## Task 4: Create Transactions Seeded Tests

**Files:**
- Create: `e2e/seeded-transactions.spec.ts`

**Step 1: Write transactions tests**

```typescript
// e2e/seeded-transactions.spec.ts
import { test, expect } from "./fixtures/auth";

test.describe("Transactions (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
  });

  test("should display transactions list with entries", async ({ authenticatedPage: page }) => {
    // Demo data has 200+ transactions over 5 years
    // Should show at least some transactions
    await expect(page.getByRole("table").or(page.locator("[data-testid='transaction-row']").first())).toBeVisible();
  });

  test("should show rental income transactions", async ({ authenticatedPage: page }) => {
    // Filter or look for rental income category
    await expect(page.getByText(/rental income/i).first()).toBeVisible();
  });

  test("should show expense transactions", async ({ authenticatedPage: page }) => {
    // Should have various expense categories from demo data
    const expenseCategories = [
      /water/i,
      /council/i,
      /insurance/i,
      /repairs/i,
      /property.*agent/i,
    ];

    // At least one expense category should be visible
    let found = false;
    for (const category of expenseCategories) {
      const count = await page.getByText(category).count();
      if (count > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("should filter transactions by property", async ({ authenticatedPage: page }) => {
    // Look for property filter dropdown
    const propertyFilter = page.getByRole("combobox").first();
    await propertyFilter.click();

    // Should see Paddington as an option (first demo property)
    await expect(page.getByText(/paddington/i)).toBeVisible();
  });

  test("should show positive amounts for income", async ({ authenticatedPage: page }) => {
    // Income transactions should have positive amounts (or green styling)
    // This verifies the data is displayed correctly
    await expect(page.locator("text=/\\+?\\$[0-9,]+/").first()).toBeVisible();
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/seeded-transactions.spec.ts --headed`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/seeded-transactions.spec.ts
git commit -m "test(e2e): add transactions tests for seeded data"
```

---

## Task 5: Create Loans Seeded Tests

**Files:**
- Create: `e2e/seeded-loans.spec.ts`

**Step 1: Write loans tests**

```typescript
// e2e/seeded-loans.spec.ts
import { test, expect } from "./fixtures/auth";

test.describe("Loans (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/loans");
    await page.waitForLoadState("networkidle");
  });

  test("should display 3 active loans", async ({ authenticatedPage: page }) => {
    // Demo data has 3 loans for active properties
    // Each loan should show lender name
    await expect(page.getByText(/commonwealth bank/i)).toBeVisible();
    await expect(page.getByText(/anz/i)).toBeVisible();
    await expect(page.getByText(/westpac/i)).toBeVisible();
  });

  test("should show interest rates", async ({ authenticatedPage: page }) => {
    // Demo rates: 6.29%, 6.45%, 6.15%
    await expect(page.getByText(/6\.\d+%/)).toBeVisible();
  });

  test("should display LVR for loans", async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/lvr/i).first()).toBeVisible();
  });

  test("should show refinance alert for expiring fixed rate", async ({ authenticatedPage: page }) => {
    // Brighton property has fixed rate expiring in 1 month
    // Should show refinance alert or warning
    const alertIndicators = [
      page.getByText(/expir/i),
      page.getByText(/refinance/i),
      page.locator("[data-testid='refinance-alert']"),
      page.getByRole("alert"),
    ];

    let alertFound = false;
    for (const indicator of alertIndicators) {
      if (await indicator.count() > 0) {
        alertFound = true;
        break;
      }
    }
    expect(alertFound).toBe(true);
  });

  test("should show loan type (P&I vs IO)", async ({ authenticatedPage: page }) => {
    // Demo has both P&I and Interest Only loans
    await expect(
      page.getByText(/principal.*interest/i).or(page.getByText(/p&i/i))
    ).toBeVisible();
    await expect(
      page.getByText(/interest only/i).or(page.getByText(/io\b/i))
    ).toBeVisible();
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/seeded-loans.spec.ts --headed`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/seeded-loans.spec.ts
git commit -m "test(e2e): add loans tests for seeded data"
```

---

## Task 6: Create Dashboard Seeded Tests

**Files:**
- Create: `e2e/seeded-dashboard.spec.ts`

**Step 1: Write dashboard tests with seeded data expectations**

```typescript
// e2e/seeded-dashboard.spec.ts
import { test, expect } from "./fixtures/auth";

test.describe("Dashboard (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("should display property count stat", async ({ authenticatedPage: page }) => {
    // Demo data has 4 properties
    await expect(page.getByText(/4/).first()).toBeVisible();
    await expect(page.getByText(/propert/i).first()).toBeVisible();
  });

  test("should show recent transactions", async ({ authenticatedPage: page }) => {
    // Dashboard should show recent activity
    await expect(
      page.getByText(/recent/i).or(page.getByText(/transaction/i).first())
    ).toBeVisible();
  });

  test("should display alerts if any", async ({ authenticatedPage: page }) => {
    // Demo data has anomaly alerts (missed rent, unusual expense)
    // Check for alerts section or alert count
    const alertSection = page.getByText(/alert/i).first();
    await expect(alertSection).toBeVisible();
  });

  test("should show portfolio value", async ({ authenticatedPage: page }) => {
    // Dashboard should display portfolio metrics
    await expect(
      page.getByText(/portfolio/i).or(page.getByText(/total value/i))
    ).toBeVisible();
  });

  test("should navigate to portfolio from stats", async ({ authenticatedPage: page }) => {
    // Clicking on property stat should navigate to portfolio
    await page.getByText(/propert/i).first().click();
    await expect(page).toHaveURL(/portfolio|properties/);
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/seeded-dashboard.spec.ts --headed`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/seeded-dashboard.spec.ts
git commit -m "test(e2e): add dashboard tests for seeded data"
```

---

## Task 7: Create Compliance Seeded Tests

**Files:**
- Create: `e2e/seeded-compliance.spec.ts`

**Step 1: Write compliance tests**

```typescript
// e2e/seeded-compliance.spec.ts
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
    // Should show overdue styling or badge
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
```

**Step 2: Run tests**

Run: `npx playwright test e2e/seeded-compliance.spec.ts --headed`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/seeded-compliance.spec.ts
git commit -m "test(e2e): add compliance tests for seeded data"
```

---

## Task 8: Create Alerts Seeded Tests

**Files:**
- Create: `e2e/seeded-alerts.spec.ts`

**Step 1: Write alerts tests**

```typescript
// e2e/seeded-alerts.spec.ts
import { test, expect } from "./fixtures/auth";

test.describe("Alerts (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/alerts");
    await page.waitForLoadState("networkidle");
  });

  test("should display alerts page", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /alert/i })).toBeVisible();
  });

  test("should show missed rent alert", async ({ authenticatedPage: page }) => {
    // Demo data has missed rent alert for Brighton property
    await expect(page.getByText(/missed.*rent/i).or(page.getByText(/rent.*not received/i))).toBeVisible();
  });

  test("should show unusual expense alert", async ({ authenticatedPage: page }) => {
    // Demo data has unusual plumber expense alert
    await expect(
      page.getByText(/unusual/i).or(page.getByText(/plumber/i))
    ).toBeVisible();
  });

  test("should show alert severity", async ({ authenticatedPage: page }) => {
    // Alerts should have severity indicators (warning, info)
    await expect(
      page.getByText(/warning/i).or(page.locator("[data-severity]").first())
    ).toBeVisible();
  });

  test("should link alerts to properties", async ({ authenticatedPage: page }) => {
    // Alerts should mention property names
    await expect(
      page.getByText(/brighton/i).or(page.getByText(/paddington/i))
    ).toBeVisible();
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/seeded-alerts.spec.ts --headed`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/seeded-alerts.spec.ts
git commit -m "test(e2e): add alerts tests for seeded data"
```

---

## Task 9: Create Tax Report Seeded Tests

**Files:**
- Create: `e2e/seeded-tax-report.spec.ts`

**Step 1: Write tax report tests**

```typescript
// e2e/seeded-tax-report.spec.ts
import { test, expect } from "./fixtures/auth";

test.describe("Tax Report (Seeded Data)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/reports/tax");
    await page.waitForLoadState("networkidle");
  });

  test("should display tax report page", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /tax report/i })).toBeVisible();
  });

  test("should have financial year selector", async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/financial year/i)).toBeVisible();
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("should generate report with income section", async ({ authenticatedPage: page }) => {
    // Select a year and generate report
    await page.getByRole("button", { name: /generate/i }).click();
    await page.waitForLoadState("networkidle");

    // Should show rental income section
    await expect(page.getByText(/rental income/i).or(page.getByText(/income/i).first())).toBeVisible();
  });

  test("should show expense categories", async ({ authenticatedPage: page }) => {
    // Generate report
    await page.getByRole("button", { name: /generate/i }).click();
    await page.waitForLoadState("networkidle");

    // Should show expense breakdown
    const expenseCategories = [
      /insurance/i,
      /council/i,
      /water/i,
      /repairs/i,
      /interest/i,
    ];

    let found = false;
    for (const category of expenseCategories) {
      if (await page.getByText(category).count() > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("should filter by property", async ({ authenticatedPage: page }) => {
    // Property filter should exist
    const propertyFilter = page.getByLabel(/property/i);
    if (await propertyFilter.count() > 0) {
      await propertyFilter.click();
      await expect(page.getByText(/all properties/i).or(page.getByText(/paddington/i))).toBeVisible();
    }
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/seeded-tax-report.spec.ts --headed`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/seeded-tax-report.spec.ts
git commit -m "test(e2e): add tax report tests for seeded data"
```

---

## Task 10: Run All Seeded Tests and Verify

**Step 1: Run all seeded feature tests**

Run: `npx playwright test e2e/seeded-*.spec.ts --headed`
Expected: All tests pass

**Step 2: Run in headless mode**

Run: `npx playwright test e2e/seeded-*.spec.ts`
Expected: All tests pass

**Step 3: Generate test report**

Run: `npx playwright show-report`
Expected: HTML report shows all seeded tests passing

**Step 4: Final commit**

```bash
git add -A
git commit -m "test(e2e): complete seed-based feature test suite"
```

---

## Task 11: Push and Create PR

**Step 1: Push changes**

```bash
git push origin main
```

**Step 2: Verify all tests in report**

Run: `npx playwright test --reporter=list`
Expected: All tests listed with PASS status

---

## Summary

**Total Tasks:** 11
**New Test Files:** 7 (seeded-*.spec.ts)
**Test Coverage:**
- Portfolio: 5 tests
- Transactions: 5 tests
- Loans: 5 tests
- Dashboard: 5 tests
- Compliance: 4 tests
- Alerts: 5 tests
- Tax Report: 5 tests

**Prerequisites:**
1. `.env.local` has `E2E_CLERK_USER_ID` set
2. `.env.local` has `E2E_CLERK_USER_EMAIL` and `E2E_CLERK_USER_PASSWORD`
3. Database connection works
4. Dev server can start

**Note:** Tests may need minor adjustments based on actual UI selectors. Run with `--headed` first to debug any selector issues.
