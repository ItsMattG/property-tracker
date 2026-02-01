# UI/UX Audit System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive Playwright-based UI/UX audit system that explores all 75 pages, captures screenshots of all states, and generates a detailed findings report.

**Architecture:** Extend the existing e2e test infrastructure with a new `e2e/ui-audit/` directory. Create a demo account fixture that uses the existing seed system with additional edge case data. Tests capture screenshots and log findings to JSON, which is then transformed into a markdown report.

**Tech Stack:** Playwright, existing seed system (`src/lib/seed/`), TypeScript

---

### Task 1: Create UI Audit Seed Profile

**Files:**
- Create: `src/lib/seed/profiles/ui-audit.ts`
- Modify: `src/lib/seed/index.ts`

**Step 1: Create the UI audit seed profile**

Create `src/lib/seed/profiles/ui-audit.ts`:

```typescript
import { demoAddresses } from "../data/addresses";
import { demoBanks } from "../data/banks";
import {
  generateProperty,
  generatePropertySale,
  generateBankAccount,
  generateTransactions,
  generateLoan,
  generateRefinanceAlert,
  generateAnomalyAlert,
  generateStandardComplianceRecords,
  type GeneratedProperty,
  type GeneratedPropertySale,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedRefinanceAlert,
  type GeneratedAnomalyAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths, addDays } from "../utils";

export interface UIAuditData {
  properties: GeneratedProperty[];
  propertySales: GeneratedPropertySale[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
  refinanceAlerts: GeneratedRefinanceAlert[];
  anomalyAlerts: GeneratedAnomalyAlert[];
  complianceRecords: GeneratedComplianceRecord[];
}

/**
 * Generate comprehensive UI audit data with all edge cases:
 * - 6 properties (various states)
 * - 4 bank accounts (connected, disconnected, error states)
 * - 150+ transactions (all categories, edge cases)
 * - Error states, time-based states, boundary cases
 */
export function generateUIAuditData(userId: string): UIAuditData {
  const now = new Date();

  // ===== PROPERTIES =====
  // 1. Fully populated property
  const prop1 = generateProperty({
    userId,
    address: "123 Investment Ave",
    suburb: "Sydney",
    state: "NSW",
    postcode: "2000",
    purchasePrice: 850000,
    purchaseDate: addMonths(now, -12), // 1 year ago
    status: "active",
  });

  // 2. Recently purchased (minimal data)
  const prop2 = generateProperty({
    userId,
    address: "45 New Street",
    suburb: "Melbourne",
    state: "VIC",
    postcode: "3000",
    purchasePrice: 720000,
    purchaseDate: addDays(now, -7), // 1 week ago
    status: "active",
  });

  // 3. Renovating property (expenses, no income)
  const prop3 = generateProperty({
    userId,
    address: "78 Renovation Road",
    suburb: "Brisbane",
    state: "QLD",
    postcode: "4000",
    purchasePrice: 550000,
    purchaseDate: addMonths(now, -3),
    status: "active",
  });

  // 4. Empty lot (land only)
  const prop4 = generateProperty({
    userId,
    address: "99 Land Street",
    suburb: "Perth",
    state: "WA",
    postcode: "6000",
    purchasePrice: 350000,
    purchaseDate: addMonths(now, -6),
    status: "active",
  });

  // 5. Sold property (CGT scenario)
  const prop5 = generateProperty({
    userId,
    address: "55 Old Street",
    suburb: "Adelaide",
    state: "SA",
    postcode: "5000",
    purchasePrice: 480000,
    purchaseDate: addMonths(now, -36), // 3 years ago
    status: "sold",
  });

  // 6. Problem property (overdue tasks, compliance warnings)
  const prop6 = generateProperty({
    userId,
    address: "12 Issue Lane",
    suburb: "Hobart",
    state: "TAS",
    postcode: "7000",
    purchasePrice: 420000,
    purchaseDate: addMonths(now, -18),
    status: "active",
  });

  const properties = [prop1, prop2, prop3, prop4, prop5, prop6];

  // Property sale for sold property
  const propertySales = [
    generatePropertySale({
      propertyId: prop5.id,
      salePrice: 620000,
      saleDate: addMonths(now, -1),
      settlementDate: addDays(now, -15),
    }),
  ];

  // ===== BANK ACCOUNTS =====
  // 1. Connected & synced - Primary offset
  const bank1 = generateBankAccount({
    userId,
    institution: demoBanks[0].name,
    accountName: "Property Offset Account",
    accountType: "offset",
    isConnected: true,
    connectionStatus: "connected",
    lastSyncedAt: addDays(now, -1), // Synced yesterday
    defaultPropertyId: prop1.id,
  });

  // 2. Connected & synced - Investment loan
  const bank2 = generateBankAccount({
    userId,
    institution: demoBanks[1].name,
    accountName: "Investment Loan",
    accountType: "mortgage",
    isConnected: true,
    connectionStatus: "connected",
    lastSyncedAt: addDays(now, -2),
    defaultPropertyId: prop1.id,
  });

  // 3. Disconnected - needs reconnection (edge case)
  const bank3 = generateBankAccount({
    userId,
    institution: demoBanks[2].name,
    accountName: "Old Savings Account",
    accountType: "savings",
    isConnected: false,
    connectionStatus: "disconnected",
    lastSyncedAt: addDays(now, -30), // Stale
  });

  // 4. Error state - sync failed (edge case)
  const bank4 = generateBankAccount({
    userId,
    institution: demoBanks[3].name,
    accountName: "Credit Card",
    accountType: "credit_card",
    isConnected: true,
    connectionStatus: "error",
    lastSyncedAt: addDays(now, -7),
    syncError: "Bank connection requires re-authentication",
  });

  const bankAccounts = [bank1, bank2, bank3, bank4];

  // ===== TRANSACTIONS =====
  const transactions: GeneratedTransaction[] = [];

  // Generate regular transactions for prop1 (fully populated)
  const prop1Transactions = generateTransactions({
    userId,
    bankAccountId: bank1.id,
    propertyId: prop1.id,
    startDate: addMonths(now, -12),
    endDate: now,
    includeRent: true,
    rentAmount: 3200,
  });
  transactions.push(...prop1Transactions);

  // Edge case: Very long description
  transactions.push({
    id: crypto.randomUUID(),
    userId,
    bankAccountId: bank1.id,
    propertyId: prop1.id,
    basiqTransactionId: `long_desc_${Date.now()}`,
    description: "This is an extremely long transaction description that exceeds the normal length to test text truncation and wrapping behavior in the UI. It includes details about property maintenance, multiple vendor names, and reference numbers like REF-2024-001234567890.",
    amount: "-1250.00",
    date: addDays(now, -5).toISOString().split("T")[0],
    category: "repairs_and_maintenance",
    transactionType: "expense",
    isDeductible: true,
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  // Edge case: Large amount
  transactions.push({
    id: crypto.randomUUID(),
    userId,
    bankAccountId: bank1.id,
    propertyId: prop1.id,
    basiqTransactionId: `large_amount_${Date.now()}`,
    description: "Major renovation payment",
    amount: "-999999.99",
    date: addDays(now, -3).toISOString().split("T")[0],
    category: "capital_works_deductions",
    transactionType: "capital",
    isDeductible: false,
    isVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  // Edge case: Uncategorized transactions (30% of total)
  for (let i = 0; i < 45; i++) {
    transactions.push({
      id: crypto.randomUUID(),
      userId,
      bankAccountId: bank1.id,
      propertyId: null, // Not assigned to property
      basiqTransactionId: `uncat_${Date.now()}_${i}`,
      description: `Transaction ${i + 1} - needs review`,
      amount: (Math.random() > 0.5 ? "-" : "") + (Math.random() * 500 + 10).toFixed(2),
      date: addDays(now, -Math.floor(Math.random() * 90)).toISOString().split("T")[0],
      category: "uncategorized",
      transactionType: "expense",
      isDeductible: false,
      isVerified: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ===== LOANS =====
  const loans = [
    generateLoan({
      userId,
      propertyId: prop1.id,
      lender: "Commonwealth Bank",
      loanType: "principal_and_interest",
      rateType: "variable",
      interestRate: 6.29,
      originalAmount: 680000,
      currentBalance: 620000,
      startDate: addMonths(now, -12),
    }),
    generateLoan({
      userId,
      propertyId: prop3.id,
      lender: "ANZ",
      loanType: "interest_only",
      rateType: "fixed",
      interestRate: 6.45,
      originalAmount: 440000,
      currentBalance: 440000,
      startDate: addMonths(now, -3),
      fixedRateExpiry: addMonths(now, 1), // Expiring soon!
    }),
  ];

  // ===== ALERTS =====
  const refinanceAlerts = [
    generateRefinanceAlert({
      userId,
      loanId: loans[1].id,
      alertType: "fixed_rate_expiring",
      message: "Fixed rate expires in 30 days. Consider refinancing options.",
      potentialSavings: 2400,
    }),
  ];

  const anomalyAlerts = [
    generateAnomalyAlert({
      userId,
      propertyId: prop6.id,
      alertType: "missed_rent",
      severity: "warning",
      message: "Expected rent payment not received for January",
    }),
    generateAnomalyAlert({
      userId,
      propertyId: prop1.id,
      alertType: "unusual_amount",
      severity: "info",
      message: "Water bill higher than usual ($450 vs $180 average)",
    }),
  ];

  // ===== COMPLIANCE RECORDS =====
  // Generate standard compliance for all active properties
  const complianceRecords: GeneratedComplianceRecord[] = [];
  for (const prop of properties.filter(p => p.status === "active")) {
    const records = generateStandardComplianceRecords({
      propertyId: prop.id,
      startDate: prop.purchaseDate,
    });
    complianceRecords.push(...records);
  }

  // Edge case: Overdue compliance for problem property
  complianceRecords.push({
    id: crypto.randomUUID(),
    propertyId: prop6.id,
    complianceType: "smoke_alarm",
    description: "Annual smoke alarm check",
    dueDate: addDays(now, -30).toISOString().split("T")[0], // Overdue!
    completedDate: null,
    status: "overdue",
    createdAt: now,
    updatedAt: now,
  });

  // Edge case: Upcoming compliance (3 days)
  complianceRecords.push({
    id: crypto.randomUUID(),
    propertyId: prop1.id,
    complianceType: "gas_safety",
    description: "Gas safety certificate renewal",
    dueDate: addDays(now, 3).toISOString().split("T")[0],
    completedDate: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  return {
    properties,
    propertySales,
    bankAccounts,
    transactions,
    loans,
    refinanceAlerts,
    anomalyAlerts,
    complianceRecords,
  };
}
```

**Step 2: Export from seed index**

Add to `src/lib/seed/index.ts` after the test exports:

```typescript
// Re-export UI audit profile
export { generateUIAuditData } from "./profiles/ui-audit";
```

**Step 3: Test the seed profile compiles**

Run: `npx tsc --noEmit src/lib/seed/profiles/ui-audit.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/seed/profiles/ui-audit.ts src/lib/seed/index.ts
git commit -m "feat(seed): add UI audit seed profile with edge cases"
```

---

### Task 2: Create UI Audit Fixture

**Files:**
- Create: `e2e/ui-audit/fixtures/demo-account.ts`
- Create: `e2e/ui-audit/fixtures/audit-logger.ts`

**Step 1: Create the demo account fixture**

Create `e2e/ui-audit/fixtures/demo-account.ts`:

```typescript
import { test as base, Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

// Demo user credentials - must exist in Clerk
const DEMO_USER_EMAIL = process.env.E2E_DEMO_USER_EMAIL || "demo@propertytracker.test";
const DEMO_USER_PASSWORD = process.env.E2E_DEMO_USER_PASSWORD || "Demo123!Property";

export interface AuditFinding {
  page: string;
  element: string;
  state: string;
  issue?: string;
  severity?: "critical" | "major" | "minor" | "suggestion";
  screenshot?: string;
}

export interface AuditContext {
  page: Page;
  findings: AuditFinding[];
  addFinding: (finding: Omit<AuditFinding, "page"> & { page?: string }) => void;
  captureState: (name: string) => Promise<void>;
}

/**
 * Extended test fixture with demo account authentication and audit helpers
 */
export const test = base.extend<{ audit: AuditContext }>({
  audit: async ({ page }, use) => {
    const findings: AuditFinding[] = [];
    let currentPage = "/";

    // Set up Clerk testing token
    await setupClerkTestingToken({ page });

    // Sign in with demo account
    if (DEMO_USER_EMAIL && DEMO_USER_PASSWORD) {
      await page.goto("/sign-in");
      await page.waitForSelector('[data-clerk-component="SignIn"]', { timeout: 15000 });

      await page.getByLabel(/email/i).fill(DEMO_USER_EMAIL);
      await page.getByRole("button", { name: "Continue", exact: true }).click();

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.waitFor({ timeout: 5000 });
      await passwordInput.fill(DEMO_USER_PASSWORD);

      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 });
    }

    // Track page navigations
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        currentPage = new URL(frame.url()).pathname;
      }
    });

    const context: AuditContext = {
      page,
      findings,
      addFinding: (finding) => {
        findings.push({
          ...finding,
          page: finding.page || currentPage,
        });
      },
      captureState: async (name: string) => {
        const screenshotName = `${currentPage.replace(/\//g, "-").slice(1) || "home"}-${name}.png`;
        await page.screenshot({
          path: `e2e/ui-audit/results/screenshots/${screenshotName}`,
          fullPage: true,
        });
      },
    };

    await use(context);

    // Write findings to JSON after test
    if (findings.length > 0) {
      const fs = await import("fs/promises");
      const existingPath = "e2e/ui-audit/results/audit-log.json";
      let existing: AuditFinding[] = [];
      try {
        const data = await fs.readFile(existingPath, "utf-8");
        existing = JSON.parse(data);
      } catch {
        // File doesn't exist yet
      }
      const combined = [...existing, ...findings];
      await fs.mkdir("e2e/ui-audit/results", { recursive: true });
      await fs.writeFile(existingPath, JSON.stringify(combined, null, 2));
    }
  },
});

export { expect } from "@playwright/test";
```

**Step 2: Create the audit logger utility**

Create `e2e/ui-audit/fixtures/audit-logger.ts`:

```typescript
import type { AuditFinding } from "./demo-account";

export class AuditLogger {
  private findings: AuditFinding[] = [];

  add(finding: AuditFinding): void {
    this.findings.push(finding);
  }

  getFindings(): AuditFinding[] {
    return [...this.findings];
  }

  getSummary(): { critical: number; major: number; minor: number; suggestion: number } {
    return {
      critical: this.findings.filter((f) => f.severity === "critical").length,
      major: this.findings.filter((f) => f.severity === "major").length,
      minor: this.findings.filter((f) => f.severity === "minor").length,
      suggestion: this.findings.filter((f) => f.severity === "suggestion").length,
    };
  }
}
```

**Step 3: Create results directory**

Run: `mkdir -p e2e/ui-audit/results/screenshots`

**Step 4: Commit**

```bash
git add e2e/ui-audit/fixtures/
git commit -m "feat(e2e): add UI audit fixtures with demo account and logger"
```

---

### Task 3: Create Public Pages Audit Tests

**Files:**
- Create: `e2e/ui-audit/public/landing.audit.ts`
- Create: `e2e/ui-audit/public/legal.audit.ts`

**Step 1: Create landing page audit test**

Create `e2e/ui-audit/public/landing.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Landing Page Audit", () => {
  test("captures all landing page states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // Navigate to landing
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
    await ctaButton.hover();
    await captureState("cta-hover");

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
      await captureState("mobile-menu-open");

      // Check mobile menu items
      const mobileSignIn = page.getByRole("link", { name: /sign in/i });
      if (!(await mobileSignIn.isVisible())) {
        addFinding({
          element: "Mobile menu Sign In",
          state: "mobile-menu-open",
          issue: "Sign In link not visible in mobile menu",
          severity: "major",
        });
      }
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Check FAQ accordion
    const faqTrigger = page.getByText(/is my data safe/i);
    if (await faqTrigger.isVisible()) {
      await faqTrigger.click();
      await captureState("faq-expanded");
    }

    // Check pricing cards
    await page.getByText(/simple pricing/i).scrollIntoViewIfNeeded();
    await captureState("pricing-section");

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
```

**Step 2: Create legal pages audit test**

Create `e2e/ui-audit/public/legal.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Legal Pages Audit", () => {
  test("captures privacy policy states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/privacy");
    await captureState("privacy-loaded");

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

    // Check mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("privacy-mobile");

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
    await captureState("terms-loaded");

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

    // Check mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("terms-mobile");

    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
```

**Step 3: Run the tests to verify they work**

Run: `npx playwright test e2e/ui-audit/public/ --project=chromium`
Expected: Tests run (may fail if demo account not set up, but structure works)

**Step 4: Commit**

```bash
git add e2e/ui-audit/public/
git commit -m "feat(e2e): add public pages UI audit tests"
```

---

### Task 4: Create Dashboard Audit Tests

**Files:**
- Create: `e2e/ui-audit/dashboard/dashboard.audit.ts`
- Create: `e2e/ui-audit/dashboard/properties.audit.ts`

**Step 1: Create dashboard audit test**

Create `e2e/ui-audit/dashboard/dashboard.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Dashboard Audit", () => {
  test("captures all dashboard states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // Navigate to dashboard
    await page.goto("/dashboard");
    await captureState("loaded");

    // Check welcome message
    const welcomeHeading = page.getByRole("heading", { name: /welcome/i });
    if (!(await welcomeHeading.isVisible())) {
      addFinding({
        element: "Welcome heading",
        state: "loaded",
        issue: "Welcome heading not visible",
        severity: "minor",
      });
    }

    // Check stats cards
    const statsCards = page.locator("[data-testid='stats-card'], .stats-card");
    const cardCount = await statsCards.count();
    if (cardCount === 0) {
      // Fallback: look for common stats text
      const propertiesText = page.getByText(/properties/i).first();
      if (!(await propertiesText.isVisible())) {
        addFinding({
          element: "Stats cards",
          state: "loaded",
          issue: "No stats cards visible on dashboard",
          severity: "major",
        });
      }
    }

    // Check sidebar navigation
    const sidebar = page.locator("aside");
    if (await sidebar.isVisible()) {
      await captureState("sidebar");

      const navItems = ["Dashboard", "Properties", "Transactions", "Banking", "Export"];
      for (const item of navItems) {
        const link = sidebar.getByRole("link", { name: new RegExp(item, "i") });
        if (!(await link.isVisible())) {
          addFinding({
            element: `Sidebar ${item} link`,
            state: "loaded",
            issue: `${item} link not visible in sidebar`,
            severity: "major",
          });
        }
      }
    } else {
      addFinding({
        element: "Sidebar",
        state: "loaded",
        issue: "Sidebar navigation not visible",
        severity: "critical",
      });
    }

    // Check mobile sidebar
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");

    // Look for mobile menu trigger
    const mobileMenuTrigger = page.locator("button[aria-label*='menu' i], button[aria-label*='sidebar' i]").first();
    if (await mobileMenuTrigger.isVisible()) {
      await mobileMenuTrigger.click();
      await page.waitForTimeout(300); // Animation
      await captureState("mobile-sidebar-open");
    }

    await page.setViewportSize({ width: 1280, height: 720 });

    // Check for any loading skeletons still visible
    const skeletons = page.locator("[data-testid='skeleton'], .skeleton, .animate-pulse");
    await page.waitForTimeout(2000);
    const skeletonCount = await skeletons.count();
    if (skeletonCount > 0) {
      addFinding({
        element: "Loading skeletons",
        state: "after-2s",
        issue: `${skeletonCount} skeleton(s) still visible after 2 seconds`,
        severity: "major",
      });
    }

    // Test Add Property button if exists
    const addPropertyBtn = page.getByRole("button", { name: /add property/i });
    if (await addPropertyBtn.isVisible()) {
      await addPropertyBtn.click();
      await page.waitForTimeout(300);
      await captureState("add-property-dialog");

      // Close dialog
      const closeBtn = page.getByRole("button", { name: /close/i });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }
  });
});
```

**Step 2: Create properties audit test**

Create `e2e/ui-audit/dashboard/properties.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Properties Page Audit", () => {
  test("captures all properties list states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/properties");
    await captureState("loaded");

    // Check heading
    const heading = page.getByRole("heading", { name: /properties/i }).first();
    if (!(await heading.isVisible())) {
      addFinding({
        element: "Properties heading",
        state: "loaded",
        issue: "Properties heading not visible",
        severity: "major",
      });
    }

    // Check for property cards or table
    const propertyItems = page.locator("[data-testid='property-card'], [data-testid='property-row'], .property-card");
    const itemCount = await propertyItems.count();

    if (itemCount === 0) {
      // Check for empty state
      const emptyState = page.getByText(/no properties/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
        addFinding({
          element: "Properties list",
          state: "empty",
          issue: "Empty state shown - verify demo data is seeded",
          severity: "suggestion",
        });
      } else {
        addFinding({
          element: "Properties list",
          state: "loaded",
          issue: "No properties visible and no empty state",
          severity: "critical",
        });
      }
    } else {
      // Click first property to see detail page
      const firstProperty = propertyItems.first();
      await firstProperty.click();
      await page.waitForURL(/\/properties\/[^/]+$/);
      await captureState("property-detail");

      // Check property detail elements
      const addressHeading = page.getByRole("heading").first();
      if (!(await addressHeading.isVisible())) {
        addFinding({
          element: "Property address heading",
          state: "detail-loaded",
          issue: "Property address heading not visible",
          severity: "major",
        });
      }

      // Check tabs if present
      const tabs = page.getByRole("tablist");
      if (await tabs.isVisible()) {
        const tabButtons = await tabs.getByRole("tab").all();
        for (const tab of tabButtons) {
          const tabName = await tab.textContent();
          await tab.click();
          await page.waitForTimeout(300);
          await captureState(`property-tab-${tabName?.toLowerCase().replace(/\s+/g, "-")}`);
        }
      }

      // Check edit button
      const editBtn = page.getByRole("link", { name: /edit/i });
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForURL(/\/properties\/[^/]+\/edit$/);
        await captureState("property-edit");

        // Check form fields
        const formInputs = page.locator("input, select, textarea");
        const inputCount = await formInputs.count();
        if (inputCount < 3) {
          addFinding({
            element: "Edit form",
            state: "loaded",
            issue: `Only ${inputCount} form fields visible, expected more`,
            severity: "minor",
          });
        }
      }
    }

    // Mobile responsiveness
    await page.goto("/properties");
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("captures property creation flow", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/properties/new");
    await captureState("new-property-loaded");

    // Check form is visible
    const form = page.locator("form");
    if (!(await form.isVisible())) {
      addFinding({
        element: "New property form",
        state: "loaded",
        issue: "New property form not visible",
        severity: "critical",
      });
      return;
    }

    // Check required fields have labels
    const addressInput = page.getByLabel(/address/i);
    if (!(await addressInput.isVisible())) {
      addFinding({
        element: "Address field",
        state: "loaded",
        issue: "Address field not visible or not properly labeled",
        severity: "major",
      });
    }

    // Test form validation
    const submitBtn = page.getByRole("button", { name: /save|create|add/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      await captureState("validation-errors");

      // Check for validation messages
      const errorMessages = page.locator("[role='alert'], .error, .text-destructive");
      const errorCount = await errorMessages.count();
      if (errorCount === 0) {
        addFinding({
          element: "Form validation",
          state: "submitted-empty",
          issue: "No validation errors shown when submitting empty form",
          severity: "major",
        });
      }
    }
  });
});
```

**Step 3: Run the dashboard tests**

Run: `npx playwright test e2e/ui-audit/dashboard/ --project=chromium`
Expected: Tests run

**Step 4: Commit**

```bash
git add e2e/ui-audit/dashboard/
git commit -m "feat(e2e): add dashboard and properties UI audit tests"
```

---

### Task 5: Create Transactions Audit Tests

**Files:**
- Create: `e2e/ui-audit/dashboard/transactions.audit.ts`

**Step 1: Create transactions audit test**

Create `e2e/ui-audit/dashboard/transactions.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Transactions Page Audit", () => {
  test("captures all transactions list states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/transactions");
    await captureState("loaded");

    // Wait for loading to complete
    await page.waitForTimeout(2000);

    // Check for table or list
    const table = page.locator("table");
    const tableVisible = await table.isVisible();

    if (!tableVisible) {
      const emptyState = page.getByText(/no transactions/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
      } else {
        addFinding({
          element: "Transactions table",
          state: "loaded",
          issue: "No transactions table or empty state visible",
          severity: "critical",
        });
      }
      return;
    }

    // Check table headers
    const headers = table.locator("th");
    const headerCount = await headers.count();
    if (headerCount < 4) {
      addFinding({
        element: "Table headers",
        state: "loaded",
        issue: `Only ${headerCount} table headers, expected at least 4`,
        severity: "minor",
      });
    }

    // Check for filters
    const filterButton = page.getByRole("button", { name: /filter/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);
      await captureState("filters-open");

      // Close filters
      await page.keyboard.press("Escape");
    }

    // Check for search
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(500);
      await captureState("search-active");
      await searchInput.clear();
    }

    // Check pagination if present
    const pagination = page.locator("[data-testid='pagination'], .pagination, nav[aria-label*='pagination' i]");
    if (await pagination.isVisible()) {
      await captureState("with-pagination");
    }

    // Check transaction row click
    const firstRow = table.locator("tbody tr").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(300);
      await captureState("row-selected");
    }

    // Test bulk actions if available
    const selectAllCheckbox = page.locator("th input[type='checkbox']").first();
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.click();
      await page.waitForTimeout(300);
      await captureState("bulk-selected");

      // Look for bulk action buttons
      const bulkActions = page.getByRole("button", { name: /categorize|delete|assign/i });
      if (await bulkActions.first().isVisible()) {
        await captureState("bulk-actions-visible");
      }
    }

    // Mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");

    // Check horizontal scroll or responsive table
    const tableBox = await table.boundingBox();
    if (tableBox && tableBox.width > 375) {
      const tableContainer = table.locator("..");
      const containerBox = await tableContainer.boundingBox();
      const overflowStyle = await tableContainer.evaluate((el) =>
        window.getComputedStyle(el).overflowX
      );

      if (overflowStyle !== "auto" && overflowStyle !== "scroll") {
        addFinding({
          element: "Transactions table",
          state: "mobile",
          issue: "Table overflows viewport without horizontal scroll",
          severity: "major",
        });
      }
    }

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("captures transaction review flow", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/transactions/review");
    await captureState("review-loaded");

    // Check for uncategorized transactions queue
    const uncategorizedCount = page.getByText(/uncategorized/i);
    if (await uncategorizedCount.isVisible()) {
      await captureState("uncategorized-queue");
    }

    // Check categorization dropdown
    const categorySelect = page.locator("select, [role='combobox']").first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await page.waitForTimeout(300);
      await captureState("category-dropdown");
    }
  });
});
```

**Step 2: Run the test**

Run: `npx playwright test e2e/ui-audit/dashboard/transactions.audit.ts --project=chromium`
Expected: Test runs

**Step 3: Commit**

```bash
git add e2e/ui-audit/dashboard/transactions.audit.ts
git commit -m "feat(e2e): add transactions UI audit tests"
```

---

### Task 6: Create Banking Audit Tests

**Files:**
- Create: `e2e/ui-audit/dashboard/banking.audit.ts`

**Step 1: Create banking audit test**

Create `e2e/ui-audit/dashboard/banking.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Banking Page Audit", () => {
  test("captures all banking connection states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/banking");
    await captureState("loaded");

    // Check for connected accounts section
    const connectedSection = page.getByText(/connected accounts/i);
    if (!(await connectedSection.isVisible())) {
      // Check for alternative layout
      const bankingHeading = page.getByRole("heading", { name: /banking|accounts/i });
      if (!(await bankingHeading.isVisible())) {
        addFinding({
          element: "Banking heading",
          state: "loaded",
          issue: "No banking section heading visible",
          severity: "major",
        });
      }
    }

    // Check for account cards
    const accountCards = page.locator("[data-testid='bank-account-card'], .bank-account-card");
    const cardCount = await accountCards.count();

    if (cardCount === 0) {
      // Check for empty state
      const emptyState = page.getByText(/no.*(accounts|connections)/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
      }
    } else {
      // Check connected account card
      const connectedCard = accountCards.first();
      await captureState("connected-accounts");

      // Check for sync status indicators
      const syncStatus = page.getByText(/synced|last sync/i).first();
      if (!(await syncStatus.isVisible())) {
        addFinding({
          element: "Sync status",
          state: "loaded",
          issue: "No sync status indicator visible on bank accounts",
          severity: "minor",
        });
      }

      // Check for error state cards (from seed data)
      const errorCard = page.getByText(/error|failed|disconnected/i).first();
      if (await errorCard.isVisible()) {
        await captureState("error-state-card");
      }

      // Check for stale data warning
      const staleWarning = page.getByText(/stale|outdated|days ago/i);
      if (await staleWarning.isVisible()) {
        await captureState("stale-data-warning");
      }
    }

    // Check Connect Bank button
    const connectBtn = page.getByRole("button", { name: /connect.*bank|add.*account/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      await page.waitForTimeout(500);
      await captureState("connect-dialog");

      // Close dialog
      await page.keyboard.press("Escape");
    } else {
      addFinding({
        element: "Connect Bank button",
        state: "loaded",
        issue: "No Connect Bank button visible",
        severity: "major",
      });
    }

    // Check reconnect flow for disconnected accounts
    const reconnectBtn = page.getByRole("button", { name: /reconnect|reauthorize/i }).first();
    if (await reconnectBtn.isVisible()) {
      await captureState("reconnect-available");
    }

    // Check sync button
    const syncBtn = page.getByRole("button", { name: /sync|refresh/i }).first();
    if (await syncBtn.isVisible()) {
      await captureState("sync-button");
    }

    // Mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await captureState("mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
```

**Step 2: Run the test**

Run: `npx playwright test e2e/ui-audit/dashboard/banking.audit.ts --project=chromium`
Expected: Test runs

**Step 3: Commit**

```bash
git add e2e/ui-audit/dashboard/banking.audit.ts
git commit -m "feat(e2e): add banking UI audit tests"
```

---

### Task 7: Create Reports Audit Tests

**Files:**
- Create: `e2e/ui-audit/reports/reports.audit.ts`

**Step 1: Create reports audit test**

Create `e2e/ui-audit/reports/reports.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Reports Pages Audit", () => {
  const reportPages = [
    { path: "/reports", name: "Reports Hub" },
    { path: "/reports/tax", name: "Tax Report" },
    { path: "/reports/cgt", name: "CGT Report" },
    { path: "/reports/portfolio", name: "Portfolio Report" },
    { path: "/reports/compliance", name: "Compliance Report" },
    { path: "/reports/scenarios", name: "Scenarios" },
    { path: "/reports/tax-position", name: "Tax Position" },
    { path: "/reports/yoy-comparison", name: "YoY Comparison" },
    { path: "/reports/audit-checks", name: "Audit Checks" },
    { path: "/reports/mytax", name: "MyTax Export" },
  ];

  for (const report of reportPages) {
    test(`captures ${report.name} states`, async ({ audit }) => {
      const { page, addFinding, captureState } = audit;

      await page.goto(report.path);
      await page.waitForTimeout(1000); // Wait for data loading
      await captureState("loaded");

      // Check for heading
      const heading = page.getByRole("heading").first();
      if (!(await heading.isVisible())) {
        addFinding({
          page: report.path,
          element: "Page heading",
          state: "loaded",
          issue: "No heading visible on report page",
          severity: "major",
        });
      }

      // Check for loading states (should be resolved after 1s)
      const spinners = page.locator(".animate-spin, [data-testid='loading']");
      if (await spinners.first().isVisible()) {
        addFinding({
          page: report.path,
          element: "Loading spinner",
          state: "after-1s",
          issue: "Loading spinner still visible after 1 second",
          severity: "minor",
        });
      }

      // Check for charts
      const charts = page.locator("canvas, svg[class*='chart'], [data-testid='chart']");
      if (await charts.first().isVisible()) {
        await captureState("with-charts");
      }

      // Check for data tables
      const tables = page.locator("table");
      if (await tables.first().isVisible()) {
        await captureState("with-table");
      }

      // Check for empty states
      const emptyState = page.getByText(/no data|no results|add.*to get started/i);
      if (await emptyState.isVisible()) {
        await captureState("empty-state");
      }

      // Check for export button
      const exportBtn = page.getByRole("button", { name: /export|download/i });
      if (await exportBtn.isVisible()) {
        await captureState("export-available");
      }

      // Check date range pickers if present
      const dateRange = page.locator("[data-testid='date-range'], .date-range-picker");
      if (await dateRange.isVisible()) {
        await dateRange.click();
        await page.waitForTimeout(300);
        await captureState("date-picker-open");
        await page.keyboard.press("Escape");
      }

      // Mobile responsiveness
      await page.setViewportSize({ width: 375, height: 667 });
      await captureState("mobile");
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  }
});
```

**Step 2: Run the tests**

Run: `npx playwright test e2e/ui-audit/reports/ --project=chromium`
Expected: Tests run for all report pages

**Step 3: Commit**

```bash
git add e2e/ui-audit/reports/
git commit -m "feat(e2e): add reports UI audit tests"
```

---

### Task 8: Create Settings Audit Tests

**Files:**
- Create: `e2e/ui-audit/settings/settings.audit.ts`

**Step 1: Create settings audit test**

Create `e2e/ui-audit/settings/settings.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Settings Pages Audit", () => {
  const settingsPages = [
    { path: "/settings/billing", name: "Billing" },
    { path: "/settings/team", name: "Team" },
    { path: "/settings/integrations", name: "Integrations" },
    { path: "/settings/notifications", name: "Notifications" },
    { path: "/settings/bug-reports", name: "Bug Reports" },
    { path: "/settings/feature-requests", name: "Feature Requests" },
    { path: "/settings/mobile", name: "Mobile" },
    { path: "/settings/refinance-alerts", name: "Refinance Alerts" },
    { path: "/settings/advisors", name: "Advisors" },
    { path: "/settings/referrals", name: "Referrals" },
    { path: "/settings/support", name: "Support" },
  ];

  for (const settings of settingsPages) {
    test(`captures ${settings.name} settings states`, async ({ audit }) => {
      const { page, addFinding, captureState } = audit;

      await page.goto(settings.path);
      await page.waitForTimeout(1000);
      await captureState("loaded");

      // Check for heading
      const heading = page.getByRole("heading").first();
      if (!(await heading.isVisible())) {
        addFinding({
          page: settings.path,
          element: "Page heading",
          state: "loaded",
          issue: "No heading visible on settings page",
          severity: "major",
        });
      }

      // Check for forms
      const forms = page.locator("form");
      if (await forms.first().isVisible()) {
        await captureState("with-form");

        // Check form has labels
        const inputs = forms.first().locator("input, select, textarea");
        const inputCount = await inputs.count();
        const labels = forms.first().locator("label");
        const labelCount = await labels.count();

        if (inputCount > 0 && labelCount < inputCount) {
          addFinding({
            page: settings.path,
            element: "Form labels",
            state: "loaded",
            issue: `${inputCount} inputs but only ${labelCount} labels`,
            severity: "minor",
          });
        }
      }

      // Check for toggle switches
      const toggles = page.locator("[role='switch'], input[type='checkbox']");
      if (await toggles.first().isVisible()) {
        await captureState("with-toggles");
      }

      // Check for save button
      const saveBtn = page.getByRole("button", { name: /save|update/i });
      if (await saveBtn.isVisible()) {
        await captureState("save-available");
      }

      // Check for danger zone (delete, disconnect)
      const dangerZone = page.getByText(/danger|delete|disconnect/i);
      if (await dangerZone.isVisible()) {
        await captureState("danger-zone");
      }

      // Mobile responsiveness
      await page.setViewportSize({ width: 375, height: 667 });
      await captureState("mobile");
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  }

  test("captures billing subscription states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/settings/billing");
    await page.waitForTimeout(1000);
    await captureState("billing-loaded");

    // Check for current plan display
    const planDisplay = page.getByText(/free|pro|business|current plan/i);
    if (!(await planDisplay.isVisible())) {
      addFinding({
        element: "Current plan",
        state: "loaded",
        issue: "Current plan not visible on billing page",
        severity: "major",
      });
    }

    // Check for upgrade button
    const upgradeBtn = page.getByRole("button", { name: /upgrade|change plan/i });
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await page.waitForTimeout(500);
      await captureState("upgrade-modal");
      await page.keyboard.press("Escape");
    }

    // Check for billing history
    const billingHistory = page.getByText(/billing history|invoices|payments/i);
    if (await billingHistory.isVisible()) {
      await captureState("billing-history");
    }
  });
});
```

**Step 2: Run the tests**

Run: `npx playwright test e2e/ui-audit/settings/ --project=chromium`
Expected: Tests run

**Step 3: Commit**

```bash
git add e2e/ui-audit/settings/
git commit -m "feat(e2e): add settings UI audit tests"
```

---

### Task 9: Create Component-Level Audit Tests

**Files:**
- Create: `e2e/ui-audit/components/dialogs.audit.ts`
- Create: `e2e/ui-audit/components/loading.audit.ts`

**Step 1: Create dialogs audit test**

Create `e2e/ui-audit/components/dialogs.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Dialog Components Audit", () => {
  test("captures confirm dialogs", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // Navigate to a page with delete functionality
    await page.goto("/properties");
    await page.waitForTimeout(1000);

    // Try to find a delete button
    const deleteBtn = page.getByRole("button", { name: /delete/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(300);
      await captureState("confirm-dialog");

      // Check dialog structure
      const dialog = page.locator("[role='alertdialog'], [role='dialog']");
      if (await dialog.isVisible()) {
        // Check for confirmation message
        const confirmText = dialog.getByText(/are you sure|confirm|cannot be undone/i);
        if (!(await confirmText.isVisible())) {
          addFinding({
            element: "Confirm dialog",
            state: "open",
            issue: "No confirmation message in delete dialog",
            severity: "major",
          });
        }

        // Check for cancel button
        const cancelBtn = dialog.getByRole("button", { name: /cancel|no/i });
        if (!(await cancelBtn.isVisible())) {
          addFinding({
            element: "Confirm dialog",
            state: "open",
            issue: "No cancel button in confirm dialog",
            severity: "critical",
          });
        }
      }

      // Close dialog
      await page.keyboard.press("Escape");
    }
  });

  test("captures form dialogs", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/dashboard");
    await page.waitForTimeout(1000);

    // Look for "Add" buttons that open form dialogs
    const addBtns = page.getByRole("button", { name: /add|create|new/i });
    const btnCount = await addBtns.count();

    for (let i = 0; i < Math.min(btnCount, 3); i++) {
      const btn = addBtns.nth(i);
      if (await btn.isVisible()) {
        const btnText = await btn.textContent();
        await btn.click();
        await page.waitForTimeout(500);

        const dialog = page.locator("[role='dialog']");
        if (await dialog.isVisible()) {
          await captureState(`form-dialog-${i}`);

          // Check dialog has close button
          const closeBtn = dialog.locator("button[aria-label*='close' i], button:has(svg)").first();
          if (!(await closeBtn.isVisible())) {
            addFinding({
              element: `Form dialog (${btnText})`,
              state: "open",
              issue: "No visible close button in dialog",
              severity: "minor",
            });
          }

          // Check dialog can be closed with Escape
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);

          if (await dialog.isVisible()) {
            addFinding({
              element: `Form dialog (${btnText})`,
              state: "escape-pressed",
              issue: "Dialog does not close with Escape key",
              severity: "minor",
            });
            // Try clicking outside or close button
            await page.click("body", { position: { x: 10, y: 10 } });
          }
        }
      }
    }
  });

  test("captures sheet/drawer dialogs", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    await page.goto("/transactions");
    await page.waitForTimeout(1000);

    // Look for filter buttons that might open sheets
    const filterBtn = page.getByRole("button", { name: /filter/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);

      const sheet = page.locator("[data-state='open'][role='dialog'], .sheet-content");
      if (await sheet.isVisible()) {
        await captureState("sheet-open");

        // Check sheet can be dismissed
        await page.keyboard.press("Escape");
      }
    }
  });
});
```

**Step 2: Create loading states audit test**

Create `e2e/ui-audit/components/loading.audit.ts`:

```typescript
import { test, expect } from "../fixtures/demo-account";

test.describe("Loading States Audit", () => {
  const pagesWithData = [
    "/dashboard",
    "/properties",
    "/transactions",
    "/banking",
    "/reports/tax",
    "/settings/billing",
  ];

  for (const pagePath of pagesWithData) {
    test(`captures loading states on ${pagePath}`, async ({ audit }) => {
      const { page, addFinding, captureState } = audit;

      // Slow down network to catch loading states
      await page.route("**/*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await route.continue();
      });

      await page.goto(pagePath);

      // Capture immediately to catch loading state
      await captureState("loading");

      // Check for skeletons
      const skeletons = page.locator(".animate-pulse, [data-testid='skeleton'], .skeleton");
      const skeletonCount = await skeletons.count();

      if (skeletonCount > 0) {
        await captureState("with-skeletons");
      } else {
        // Check for spinners
        const spinners = page.locator(".animate-spin, [data-testid='loading-spinner']");
        if (await spinners.first().isVisible()) {
          await captureState("with-spinner");
        } else {
          addFinding({
            page: pagePath,
            element: "Loading state",
            state: "initial-load",
            issue: "No visible loading indicator (skeleton or spinner)",
            severity: "minor",
          });
        }
      }

      // Wait for load and capture final state
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      await captureState("loaded");

      // Check skeletons are gone
      const remainingSkeletons = await skeletons.count();
      if (remainingSkeletons > 0) {
        addFinding({
          page: pagePath,
          element: "Loading skeletons",
          state: "after-network-idle",
          issue: `${remainingSkeletons} skeleton(s) still visible after load complete`,
          severity: "major",
        });
      }
    });
  }

  test("captures empty states", async ({ audit }) => {
    const { page, addFinding, captureState } = audit;

    // These pages should show empty states for new users
    const emptyStatePaths = [
      { path: "/properties", expected: "No properties" },
      { path: "/transactions", expected: "No transactions" },
      { path: "/banking", expected: "No bank accounts" },
    ];

    // For audit purposes, just check that empty states have proper styling
    for (const { path, expected } of emptyStatePaths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const emptyState = page.locator("[data-testid='empty-state'], .empty-state");
      if (await emptyState.isVisible()) {
        await captureState(`${path.slice(1)}-empty`);

        // Check for call-to-action in empty state
        const ctaButton = emptyState.getByRole("button");
        if (!(await ctaButton.isVisible())) {
          const ctaLink = emptyState.getByRole("link");
          if (!(await ctaLink.isVisible())) {
            addFinding({
              page: path,
              element: "Empty state",
              state: "displayed",
              issue: "Empty state has no call-to-action button or link",
              severity: "suggestion",
            });
          }
        }
      }
    }
  });
});
```

**Step 3: Run the tests**

Run: `npx playwright test e2e/ui-audit/components/ --project=chromium`
Expected: Tests run

**Step 4: Commit**

```bash
git add e2e/ui-audit/components/
git commit -m "feat(e2e): add component-level UI audit tests"
```

---

### Task 10: Create Report Generator Script

**Files:**
- Create: `scripts/generate-audit-report.ts`
- Modify: `package.json` (add scripts)

**Step 1: Create the report generator**

Create `scripts/generate-audit-report.ts`:

```typescript
import * as fs from "fs/promises";
import * as path from "path";

interface AuditFinding {
  page: string;
  element: string;
  state: string;
  issue?: string;
  severity?: "critical" | "major" | "minor" | "suggestion";
  screenshot?: string;
}

interface AuditSummary {
  critical: number;
  major: number;
  minor: number;
  suggestion: number;
}

async function generateReport(): Promise<void> {
  const auditLogPath = path.join(__dirname, "../e2e/ui-audit/results/audit-log.json");
  const screenshotsDir = path.join(__dirname, "../e2e/ui-audit/results/screenshots");
  const outputPath = path.join(__dirname, "../docs/ui-ux-audit-report.md");

  // Read audit log
  let findings: AuditFinding[] = [];
  try {
    const data = await fs.readFile(auditLogPath, "utf-8");
    findings = JSON.parse(data);
  } catch {
    console.log("No audit log found. Run the audit tests first.");
    findings = [];
  }

  // Get screenshots
  let screenshots: string[] = [];
  try {
    screenshots = await fs.readdir(screenshotsDir);
  } catch {
    screenshots = [];
  }

  // Calculate summary
  const summary: AuditSummary = {
    critical: findings.filter((f) => f.severity === "critical").length,
    major: findings.filter((f) => f.severity === "major").length,
    minor: findings.filter((f) => f.severity === "minor").length,
    suggestion: findings.filter((f) => f.severity === "suggestion").length,
  };

  // Group findings by page
  const byPage = new Map<string, AuditFinding[]>();
  for (const finding of findings) {
    const page = finding.page || "unknown";
    if (!byPage.has(page)) {
      byPage.set(page, []);
    }
    byPage.get(page)!.push(finding);
  }

  // Group findings by severity
  const bySeverity = {
    critical: findings.filter((f) => f.severity === "critical"),
    major: findings.filter((f) => f.severity === "major"),
    minor: findings.filter((f) => f.severity === "minor"),
    suggestion: findings.filter((f) => f.severity === "suggestion"),
  };

  // Generate markdown
  const now = new Date().toISOString().split("T")[0];
  let md = `# PropertyTracker UI/UX Audit Report

**Generated:** ${now}
**Pages Audited:** ${byPage.size}
**Total Findings:** ${findings.length}
**Screenshots Captured:** ${screenshots.length}

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | ${summary.critical} |
| Major | ${summary.major} |
| Minor | ${summary.minor} |
| Suggestions | ${summary.suggestion} |

---

## Findings by Severity

`;

  // Critical findings
  if (bySeverity.critical.length > 0) {
    md += `### Critical Issues (Blocks user flow)\n\n`;
    for (const finding of bySeverity.critical) {
      md += `- **${finding.page}** - ${finding.element}: ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  }

  // Major findings
  if (bySeverity.major.length > 0) {
    md += `### Major Issues (Degrades experience)\n\n`;
    for (const finding of bySeverity.major) {
      md += `- **${finding.page}** - ${finding.element}: ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  }

  // Minor findings
  if (bySeverity.minor.length > 0) {
    md += `### Minor Issues (Polish/consistency)\n\n`;
    for (const finding of bySeverity.minor) {
      md += `- **${finding.page}** - ${finding.element}: ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  }

  // Suggestions
  if (bySeverity.suggestion.length > 0) {
    md += `### Suggestions (Nice to have)\n\n`;
    for (const finding of bySeverity.suggestion) {
      md += `- **${finding.page}** - ${finding.element}: ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  }

  md += `---

## Findings by Page

`;

  // Findings by page
  for (const [page, pageFindings] of byPage) {
    md += `### ${page}\n\n`;
    if (pageFindings.length === 0) {
      md += "No issues found.\n\n";
    } else {
      md += "| Element | State | Issue | Severity |\n";
      md += "|---------|-------|-------|----------|\n";
      for (const finding of pageFindings) {
        md += `| ${finding.element} | ${finding.state} | ${finding.issue || "-"} | ${finding.severity || "-"} |\n`;
      }
      md += "\n";
    }
  }

  md += `---

## Screenshots

Screenshots are stored in \`e2e/ui-audit/results/screenshots/\`:

`;

  for (const screenshot of screenshots.sort()) {
    md += `- \`${screenshot}\`\n`;
  }

  md += `
---

## Recommendations

Based on the audit findings, prioritize fixes in this order:

1. **Critical Issues** - Fix immediately, these block users
2. **Major Issues** - Fix in next sprint, these hurt UX significantly
3. **Minor Issues** - Address when touching related code
4. **Suggestions** - Nice to have, low priority

---

*Report generated by PropertyTracker UI Audit System*
`;

  // Write report
  await fs.writeFile(outputPath, md);
  console.log(`Report generated: ${outputPath}`);
  console.log(`Summary: ${summary.critical} critical, ${summary.major} major, ${summary.minor} minor, ${summary.suggestion} suggestions`);
}

generateReport().catch(console.error);
```

**Step 2: Add npm scripts**

Add to `package.json` scripts section:

```json
{
  "scripts": {
    "test:ui-audit": "playwright test e2e/ui-audit/ --project=chromium",
    "ui-audit:report": "npx tsx scripts/generate-audit-report.ts"
  }
}
```

**Step 3: Test the script**

Run: `npx tsx scripts/generate-audit-report.ts`
Expected: Script runs and generates empty report (no data yet)

**Step 4: Commit**

```bash
git add scripts/generate-audit-report.ts package.json
git commit -m "feat: add UI audit report generator script"
```

---

### Task 11: Add npm Scripts and Documentation

**Files:**
- Modify: `package.json`
- Create: `e2e/ui-audit/README.md`

**Step 1: Update package.json with all audit scripts**

Add/update scripts in `package.json`:

```json
{
  "scripts": {
    "test:ui-audit": "playwright test e2e/ui-audit/ --project=chromium",
    "test:ui-audit:public": "playwright test e2e/ui-audit/public/ --project=chromium",
    "test:ui-audit:dashboard": "playwright test e2e/ui-audit/dashboard/ --project=chromium",
    "test:ui-audit:reports": "playwright test e2e/ui-audit/reports/ --project=chromium",
    "test:ui-audit:settings": "playwright test e2e/ui-audit/settings/ --project=chromium",
    "ui-audit:report": "npx tsx scripts/generate-audit-report.ts",
    "ui-audit:full": "npm run test:ui-audit && npm run ui-audit:report"
  }
}
```

**Step 2: Create README for UI audit**

Create `e2e/ui-audit/README.md`:

```markdown
# UI/UX Audit System

Automated UI/UX audit for PropertyTracker using Playwright.

## Quick Start

```bash
# Run full audit and generate report
npm run ui-audit:full

# Run only specific sections
npm run test:ui-audit:public
npm run test:ui-audit:dashboard
npm run test:ui-audit:reports
npm run test:ui-audit:settings

# Generate report from existing results
npm run ui-audit:report
```

## Prerequisites

1. Demo account must exist in Clerk with email/password auth
2. Demo account should be seeded with edge case data

Set environment variables:
```bash
E2E_DEMO_USER_EMAIL=demo@propertytracker.test
E2E_DEMO_USER_PASSWORD=Demo123!Property
```

## What Gets Tested

### Pages Covered
- Public: Landing, Privacy, Terms
- Auth: Sign-in, Sign-up flows
- Dashboard: Main dashboard, Properties, Transactions, Banking
- Reports: Tax, CGT, Portfolio, Scenarios, etc.
- Settings: Billing, Team, Integrations, etc.

### States Captured
- Page loaded state
- Loading/skeleton states
- Empty states
- Error states
- Mobile responsiveness
- Dialog open/close
- Form validation

## Output

- **Screenshots**: `e2e/ui-audit/results/screenshots/`
- **Audit Log**: `e2e/ui-audit/results/audit-log.json`
- **Report**: `docs/ui-ux-audit-report.md`

## Finding Severities

| Severity | Definition |
|----------|------------|
| Critical | Blocks user from completing task |
| Major | Significantly degrades experience |
| Minor | Polish/consistency issue |
| Suggestion | Enhancement opportunity |
```

**Step 3: Commit**

```bash
git add package.json e2e/ui-audit/README.md
git commit -m "docs: add UI audit documentation and npm scripts"
```

---

### Task 12: Run Full Audit and Generate Report

**Step 1: Seed demo data (if not already done)**

```bash
npm run seed:demo -- --clerk-id=<demo_user_clerk_id> --clean
```

**Step 2: Run the full UI audit**

Run: `npm run ui-audit:full`
Expected: All tests run, screenshots captured, report generated

**Step 3: Review the generated report**

Open `docs/ui-ux-audit-report.md` and verify:
- Summary statistics are accurate
- Findings are categorized correctly
- Screenshots are listed
- Recommendations section is populated

**Step 4: Commit final results**

```bash
git add docs/ui-ux-audit-report.md e2e/ui-audit/results/
git commit -m "docs: add initial UI/UX audit results"
```

---

## Final Checklist

- [ ] UI audit seed profile created with all edge cases
- [ ] Demo account fixture working with authentication
- [ ] Public pages audit tests complete
- [ ] Dashboard pages audit tests complete
- [ ] Reports pages audit tests complete
- [ ] Settings pages audit tests complete
- [ ] Component-level audit tests complete
- [ ] Report generator script working
- [ ] npm scripts configured
- [ ] Documentation added
- [ ] Full audit run successfully
- [ ] Report generated and reviewed
