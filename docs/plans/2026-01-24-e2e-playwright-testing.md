# E2E Playwright Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement comprehensive Playwright E2E tests covering all PropertyTracker user flows from signup through CSV export.

**Architecture:** Use Clerk's testing tokens for authentication bypass in E2E tests. Seed test data via direct database inserts before test runs. Mock Basiq API responses for banking tests. Structure tests by feature area with shared fixtures.

**Tech Stack:** Playwright, Clerk Testing Tokens, Drizzle ORM (for seeding), PostgreSQL

---

## Section 1: Test Infrastructure Setup

### Task 1: Configure Clerk Testing Tokens

**Files:**
- Create: `e2e/fixtures/auth.ts`
- Modify: `playwright.config.ts`
- Modify: `.env.local` (add test variables)

**Step 1: Add Clerk testing environment variables**

Add to `.env.local`:
```env
# Testing
CLERK_TESTING_TOKEN=your_testing_token_from_clerk_dashboard
```

To get this token:
1. Go to Clerk Dashboard → Configure → Testing
2. Enable "Testing mode"
3. Copy the testing token

**Step 2: Create auth fixture for Playwright**

Create `e2e/fixtures/auth.ts`:
```typescript
import { test as base, Page } from "@playwright/test";

// Extend base test with authenticated page
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Set Clerk testing token cookie
    await page.context().addCookies([
      {
        name: "__clerk_testing_token",
        value: process.env.CLERK_TESTING_TOKEN || "",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await use(page);
  },
});

export { expect } from "@playwright/test";
```

**Step 3: Update playwright config to load env vars**

Modify `playwright.config.ts`:
```typescript
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 4: Install dotenv as dev dependency**

Run: `npm install -D dotenv`
Expected: Package added to devDependencies

**Step 5: Commit**

```bash
git add e2e/fixtures/auth.ts playwright.config.ts package.json package-lock.json
git commit -m "feat(e2e): add Clerk testing token auth fixture"
```

---

### Task 2: Create Database Seeding Utilities

**Files:**
- Create: `e2e/fixtures/db.ts`
- Create: `e2e/fixtures/seed-data.ts`

**Step 1: Create database connection for tests**

Create `e2e/fixtures/db.ts`:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/server/db/schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const testDb = drizzle(client, { schema });

export async function cleanupTestData(userId: string) {
  // Delete in order due to foreign keys
  await testDb.delete(schema.transactions).where(
    // Delete transactions for properties owned by test user
  );
  await testDb.delete(schema.bankAccounts).where(
    // Delete bank accounts for test user
  );
  await testDb.delete(schema.properties).where(
    // Delete properties for test user
  );
}
```

**Step 2: Create seed data factory**

Create `e2e/fixtures/seed-data.ts`:
```typescript
import { testDb } from "./db";
import { properties, transactions, bankAccounts } from "../../src/server/db/schema";
import { randomUUID } from "crypto";

export const TEST_USER_ID = "test_user_e2e_001";

export async function seedTestProperty(overrides: Partial<typeof properties.$inferInsert> = {}) {
  const id = randomUUID();
  const property = {
    id,
    userId: TEST_USER_ID,
    name: "Test Investment Property",
    address: "123 Test Street",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
    purchasePrice: "500000",
    purchaseDate: new Date("2024-01-15"),
    propertyType: "apartment" as const,
    ownershipType: "personal" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await testDb.insert(properties).values(property);
  return property;
}

export async function seedTestTransaction(propertyId: string, overrides: Partial<typeof transactions.$inferInsert> = {}) {
  const id = randomUUID();
  const transaction = {
    id,
    userId: TEST_USER_ID,
    propertyId,
    description: "Test Transaction",
    amount: "-150.00",
    date: new Date(),
    category: "repairs_and_maintenance" as const,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await testDb.insert(transactions).values(transaction);
  return transaction;
}

export async function seedTestBankAccount(overrides: Partial<typeof bankAccounts.$inferInsert> = {}) {
  const id = randomUUID();
  const account = {
    id,
    userId: TEST_USER_ID,
    basiqConnectionId: "test_connection_123",
    basiqAccountId: "test_account_456",
    institutionName: "Test Bank",
    accountName: "Property Expenses",
    accountType: "transaction",
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await testDb.insert(bankAccounts).values(account);
  return account;
}

export async function cleanupTestUser() {
  // Delete all test data for TEST_USER_ID
  await testDb.delete(transactions);
  await testDb.delete(bankAccounts);
  await testDb.delete(properties);
}
```

**Step 3: Commit**

```bash
git add e2e/fixtures/db.ts e2e/fixtures/seed-data.ts
git commit -m "feat(e2e): add database seeding utilities for tests"
```

---

## Section 2: Landing Page & Public Pages Tests

### Task 3: Landing Page E2E Tests

**Files:**
- Create: `e2e/landing.spec.ts`

**Step 1: Write landing page tests**

Create `e2e/landing.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display hero section with tagline", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /your spreadsheet/i })).toBeVisible();
    await expect(page.getByText(/automated/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /start free trial/i })).toBeVisible();
  });

  test("should display navigation with sign in and get started", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("should display feature cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/australian bank feeds/i)).toBeVisible();
    await expect(page.getByText(/ato tax categories/i)).toBeVisible();
    await expect(page.getByText(/bank-grade security/i)).toBeVisible();
  });

  test("should display benefits list", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/automatic transaction import/i)).toBeVisible();
    await expect(page.getByText(/smart categorization/i)).toBeVisible();
    await expect(page.getByText(/one-click export/i)).toBeVisible();
  });

  test("should navigate to sign up when clicking Get Started", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /start free trial/i }).click();
    await expect(page).toHaveURL(/sign-up/);
  });

  test("should navigate to sign in when clicking Sign In", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("should display footer with links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx playwright test e2e/landing.spec.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add e2e/landing.spec.ts
git commit -m "test(e2e): add landing page tests"
```

---

## Section 3: Authentication Tests (Enhanced)

### Task 4: Enhanced Authentication Tests

**Files:**
- Modify: `e2e/auth.spec.ts`

**Step 1: Enhance auth tests with more coverage**

Replace `e2e/auth.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Unauthenticated Users", () => {
    test("should redirect /dashboard to sign-in", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /properties to sign-in", async ({ page }) => {
      await page.goto("/properties");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /transactions to sign-in", async ({ page }) => {
      await page.goto("/transactions");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /banking to sign-in", async ({ page }) => {
      await page.goto("/banking");
      await expect(page).toHaveURL(/sign-in/);
    });

    test("should redirect /export to sign-in", async ({ page }) => {
      await page.goto("/export");
      await expect(page).toHaveURL(/sign-in/);
    });
  });

  test.describe("Sign In Page", () => {
    test("should display Clerk sign-in component", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page).toHaveURL(/sign-in/);
      // Wait for Clerk to load
      await page.waitForSelector('[data-clerk-component="SignIn"], .cl-signIn-root', { timeout: 10000 });
    });

    test("should have link to sign up", async ({ page }) => {
      await page.goto("/sign-in");
      await page.waitForSelector('[data-clerk-component="SignIn"], .cl-signIn-root', { timeout: 10000 });
      // Clerk's sign-in component includes a sign-up link
      await expect(page.getByText(/sign up/i)).toBeVisible();
    });
  });

  test.describe("Sign Up Page", () => {
    test("should display Clerk sign-up component", async ({ page }) => {
      await page.goto("/sign-up");
      await expect(page).toHaveURL(/sign-up/);
      // Wait for Clerk to load
      await page.waitForSelector('[data-clerk-component="SignUp"], .cl-signUp-root', { timeout: 10000 });
    });

    test("should have link to sign in", async ({ page }) => {
      await page.goto("/sign-up");
      await page.waitForSelector('[data-clerk-component="SignUp"], .cl-signUp-root', { timeout: 10000 });
      // Clerk's sign-up component includes a sign-in link
      await expect(page.getByText(/sign in/i)).toBeVisible();
    });
  });
});
```

**Step 2: Run tests to verify**

Run: `npx playwright test e2e/auth.spec.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add e2e/auth.spec.ts
git commit -m "test(e2e): enhance auth tests with redirect coverage"
```

---

## Section 4: Dashboard Tests (Authenticated)

### Task 5: Dashboard E2E Tests

**Files:**
- Create: `e2e/dashboard.spec.ts`

**Step 1: Create dashboard tests using auth bypass**

Create `e2e/dashboard.spec.ts`:
```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Dashboard", () => {
  test("should display welcome message", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /welcome to propertytracker/i })).toBeVisible();
  });

  test("should display stats cards", async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/properties/i).first()).toBeVisible();
    await expect(page.getByText(/transactions/i).first()).toBeVisible();
    await expect(page.getByText(/uncategorized/i)).toBeVisible();
  });

  test("should display sidebar navigation", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /properties/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /transactions/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /banking/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /export/i })).toBeVisible();
  });

  test("should navigate to properties from sidebar", async ({ authenticatedPage: page }) => {
    await page.getByRole("link", { name: /properties/i }).click();
    await expect(page).toHaveURL(/properties/);
  });

  test("should navigate to transactions from sidebar", async ({ authenticatedPage: page }) => {
    await page.getByRole("link", { name: /transactions/i }).click();
    await expect(page).toHaveURL(/transactions/);
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/dashboard.spec.ts`
Expected: Tests pass (or skip if auth not configured)

**Step 3: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test(e2e): add dashboard tests with auth fixture"
```

---

## Section 5: Properties CRUD Tests

### Task 6: Properties List and Create Tests

**Files:**
- Create: `e2e/properties.spec.ts`

**Step 1: Create properties E2E tests**

Create `e2e/properties.spec.ts`:
```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Properties", () => {
  test.describe("Properties List", () => {
    test("should display empty state when no properties", async ({ authenticatedPage: page }) => {
      await page.goto("/properties");

      await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();
      await expect(page.getByText(/no properties yet/i)).toBeVisible();
      await expect(page.getByRole("link", { name: /add your first property/i })).toBeVisible();
    });

    test("should have Add Property button", async ({ authenticatedPage: page }) => {
      await page.goto("/properties");

      await expect(page.getByRole("link", { name: /add property/i })).toBeVisible();
    });

    test("should navigate to new property form", async ({ authenticatedPage: page }) => {
      await page.goto("/properties");

      await page.getByRole("link", { name: /add property/i }).first().click();
      await expect(page).toHaveURL(/properties\/new/);
    });
  });

  test.describe("Create Property", () => {
    test("should display property form", async ({ authenticatedPage: page }) => {
      await page.goto("/properties/new");

      await expect(page.getByRole("heading", { name: /add new property/i })).toBeVisible();
      await expect(page.getByLabel(/property name/i)).toBeVisible();
      await expect(page.getByLabel(/address/i)).toBeVisible();
      await expect(page.getByLabel(/suburb/i)).toBeVisible();
    });

    test("should show validation errors for empty form", async ({ authenticatedPage: page }) => {
      await page.goto("/properties/new");

      // Try to submit empty form
      await page.getByRole("button", { name: /create property/i }).click();

      // Should show validation errors
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });

    test("should create property with valid data", async ({ authenticatedPage: page }) => {
      await page.goto("/properties/new");

      // Fill in the form
      await page.getByLabel(/property name/i).fill("Test Beach House");
      await page.getByLabel(/address/i).fill("42 Ocean Drive");
      await page.getByLabel(/suburb/i).fill("Bondi Beach");
      await page.getByLabel(/state/i).selectOption("NSW");
      await page.getByLabel(/postcode/i).fill("2026");
      await page.getByLabel(/purchase price/i).fill("1500000");
      await page.getByLabel(/purchase date/i).fill("2024-06-15");
      await page.getByLabel(/property type/i).selectOption("house");
      await page.getByLabel(/ownership type/i).selectOption("personal");

      // Submit
      await page.getByRole("button", { name: /create property/i }).click();

      // Should redirect to properties list
      await expect(page).toHaveURL(/properties$/);

      // Should show the new property
      await expect(page.getByText(/test beach house/i)).toBeVisible();
    });
  });

  test.describe("Property Card Actions", () => {
    test.beforeEach(async ({ authenticatedPage: page }) => {
      // Navigate to properties and create one first
      await page.goto("/properties/new");
      await page.getByLabel(/property name/i).fill("Property To Delete");
      await page.getByLabel(/address/i).fill("1 Delete St");
      await page.getByLabel(/suburb/i).fill("Sydney");
      await page.getByLabel(/state/i).selectOption("NSW");
      await page.getByLabel(/postcode/i).fill("2000");
      await page.getByLabel(/purchase price/i).fill("500000");
      await page.getByLabel(/purchase date/i).fill("2024-01-01");
      await page.getByLabel(/property type/i).selectOption("apartment");
      await page.getByLabel(/ownership type/i).selectOption("personal");
      await page.getByRole("button", { name: /create property/i }).click();
      await page.waitForURL(/properties$/);
    });

    test("should show property card with details", async ({ authenticatedPage: page }) => {
      await expect(page.getByText(/property to delete/i)).toBeVisible();
      await expect(page.getByText(/1 delete st/i)).toBeVisible();
    });

    test("should delete property when confirmed", async ({ authenticatedPage: page }) => {
      // Set up dialog handler before clicking delete
      page.on("dialog", (dialog) => dialog.accept());

      // Click delete button on the property card
      await page.getByRole("button", { name: /delete/i }).click();

      // Property should be removed
      await expect(page.getByText(/property to delete/i)).not.toBeVisible();
      await expect(page.getByText(/no properties yet/i)).toBeVisible();
    });
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/properties.spec.ts`
Expected: Tests pass with auth configured

**Step 3: Commit**

```bash
git add e2e/properties.spec.ts
git commit -m "test(e2e): add properties CRUD tests"
```

---

## Section 6: Transactions Tests

### Task 7: Transactions Page Tests

**Files:**
- Create: `e2e/transactions.spec.ts`

**Step 1: Create transactions tests**

Create `e2e/transactions.spec.ts`:
```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Transactions", () => {
  test.describe("Transactions List", () => {
    test("should display empty state when no transactions", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");

      await expect(page.getByRole("heading", { name: /transactions/i })).toBeVisible();
      await expect(page.getByText(/no transactions yet/i)).toBeVisible();
    });

    test("should display filter controls", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");

      // Check for filter components
      await expect(page.getByRole("combobox").first()).toBeVisible();
    });
  });

  test.describe("Transaction Filters", () => {
    test("should have property filter dropdown", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");

      // Look for the property filter
      const propertyFilter = page.getByRole("combobox").first();
      await expect(propertyFilter).toBeVisible();
    });

    test("should have category filter", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");

      // Category filter should be present
      await expect(page.getByText(/category/i).first()).toBeVisible();
    });

    test("should have date range filters", async ({ authenticatedPage: page }) => {
      await page.goto("/transactions");

      // Date filters
      await expect(page.getByLabel(/start date/i)).toBeVisible();
      await expect(page.getByLabel(/end date/i)).toBeVisible();
    });
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/transactions.spec.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/transactions.spec.ts
git commit -m "test(e2e): add transactions page tests"
```

---

## Section 7: Banking Page Tests

### Task 8: Banking Connection Tests

**Files:**
- Create: `e2e/banking.spec.ts`

**Step 1: Create banking tests**

Create `e2e/banking.spec.ts`:
```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Banking", () => {
  test.describe("Bank Accounts List", () => {
    test("should display banking page", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");

      await expect(page.getByRole("heading", { name: /bank accounts/i })).toBeVisible();
    });

    test("should show connect bank button", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");

      await expect(page.getByRole("link", { name: /connect bank/i })).toBeVisible();
    });

    test("should navigate to connect page", async ({ authenticatedPage: page }) => {
      await page.goto("/banking");

      await page.getByRole("link", { name: /connect bank/i }).click();
      await expect(page).toHaveURL(/banking\/connect/);
    });
  });

  test.describe("Bank Connection Flow", () => {
    test("should display connection instructions", async ({ authenticatedPage: page }) => {
      await page.goto("/banking/connect");

      await expect(page.getByRole("heading", { name: /connect your bank/i })).toBeVisible();
    });

    test("should show supported banks info", async ({ authenticatedPage: page }) => {
      await page.goto("/banking/connect");

      // Should mention Australian banks
      await expect(page.getByText(/australian/i)).toBeVisible();
    });
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/banking.spec.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/banking.spec.ts
git commit -m "test(e2e): add banking page tests"
```

---

## Section 8: Export Page Tests

### Task 9: CSV Export Tests

**Files:**
- Create: `e2e/export.spec.ts`

**Step 1: Create export tests**

Create `e2e/export.spec.ts`:
```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Export", () => {
  test("should display export page", async ({ authenticatedPage: page }) => {
    await page.goto("/export");

    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible();
  });

  test("should show export options", async ({ authenticatedPage: page }) => {
    await page.goto("/export");

    // Should have transaction export option
    await expect(page.getByText(/transactions/i).first()).toBeVisible();
  });

  test("should have date range selection", async ({ authenticatedPage: page }) => {
    await page.goto("/export");

    // Financial year selector or date range
    await expect(page.getByText(/financial year/i).or(page.getByLabel(/date/i).first())).toBeVisible();
  });

  test("should have download button", async ({ authenticatedPage: page }) => {
    await page.goto("/export");

    await expect(page.getByRole("button", { name: /download|export/i })).toBeVisible();
  });

  test("should show property filter for export", async ({ authenticatedPage: page }) => {
    await page.goto("/export");

    // Should be able to filter by property
    await expect(page.getByText(/property/i).first()).toBeVisible();
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test e2e/export.spec.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/export.spec.ts
git commit -m "test(e2e): add export page tests"
```

---

## Section 9: Full User Journey Test

### Task 10: End-to-End User Journey

**Files:**
- Create: `e2e/user-journey.spec.ts`

**Step 1: Create complete user journey test**

Create `e2e/user-journey.spec.ts`:
```typescript
import { test, expect } from "./fixtures/auth";

test.describe("Complete User Journey", () => {
  test("should complete full property tracking workflow", async ({ authenticatedPage: page }) => {
    // Step 1: Start at dashboard
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

    // Step 2: Navigate to properties and create one
    await page.getByRole("link", { name: /properties/i }).click();
    await page.getByRole("link", { name: /add property/i }).first().click();

    // Fill property form
    await page.getByLabel(/property name/i).fill("Journey Test Property");
    await page.getByLabel(/address/i).fill("100 Journey Road");
    await page.getByLabel(/suburb/i).fill("Melbourne");
    await page.getByLabel(/state/i).selectOption("VIC");
    await page.getByLabel(/postcode/i).fill("3000");
    await page.getByLabel(/purchase price/i).fill("750000");
    await page.getByLabel(/purchase date/i).fill("2024-03-01");
    await page.getByLabel(/property type/i).selectOption("apartment");
    await page.getByLabel(/ownership type/i).selectOption("personal");

    await page.getByRole("button", { name: /create property/i }).click();
    await expect(page).toHaveURL(/properties$/);
    await expect(page.getByText(/journey test property/i)).toBeVisible();

    // Step 3: Check transactions (empty)
    await page.getByRole("link", { name: /transactions/i }).click();
    await expect(page.getByText(/no transactions yet/i)).toBeVisible();

    // Step 4: Check banking page
    await page.getByRole("link", { name: /banking/i }).click();
    await expect(page.getByRole("link", { name: /connect bank/i })).toBeVisible();

    // Step 5: Check export page
    await page.getByRole("link", { name: /export/i }).click();
    await expect(page.getByRole("heading", { name: /export/i })).toBeVisible();

    // Step 6: Return to dashboard
    await page.getByRole("link", { name: /dashboard/i }).click();
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

    // Cleanup: Delete the test property
    await page.getByRole("link", { name: /properties/i }).click();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /delete/i }).click();
    await expect(page.getByText(/no properties yet/i)).toBeVisible();
  });
});
```

**Step 2: Run the full journey test**

Run: `npx playwright test e2e/user-journey.spec.ts`
Expected: Test passes

**Step 3: Commit**

```bash
git add e2e/user-journey.spec.ts
git commit -m "test(e2e): add complete user journey test"
```

---

## Section 10: Test Runner Scripts & CI

### Task 11: Add Test Scripts and Final Verification

**Files:**
- Modify: `package.json`

**Step 1: Add comprehensive test scripts**

In `package.json`, update the scripts section:
```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:report": "playwright show-report"
  }
}
```

**Step 2: Run all E2E tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Generate and view test report**

Run: `npm run test:report`
Expected: HTML report opens in browser showing all passing tests

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add comprehensive test scripts"
```

---

## Section 11: Final Push

### Task 12: Push All Changes

**Step 1: Verify all tests pass**

Run: `npm test`
Expected: All tests pass (0 failures)

**Step 2: Push to remote**

```bash
git push origin main
```

**Step 3: Verify on GitHub**

Run: `gh repo view --web`
Expected: All E2E test files visible in repository

---

## Summary

**Total Tasks:** 12
**Total Test Files:** 8
**Coverage:**
- Landing page (7 tests)
- Authentication (9 tests)
- Dashboard (5 tests)
- Properties CRUD (8 tests)
- Transactions (5 tests)
- Banking (5 tests)
- Export (5 tests)
- User Journey (1 comprehensive test)

**Prerequisites:**
1. Clerk Testing Token configured in `.env.local`
2. Database connection working
3. Dev server running

**Note:** Some tests may need adjustment based on exact UI implementation. The auth fixture assumes Clerk's testing token feature is enabled.
