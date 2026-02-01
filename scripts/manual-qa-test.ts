import { chromium, Page } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { config } from "dotenv";

config({ path: ".env.local" });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://property-tracker-seven.vercel.app";
const TEST_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.E2E_CLERK_USER_PASSWORD!;

interface TestResult {
  page: string;
  status: "pass" | "fail" | "warning";
  message: string;
  screenshot?: string;
}

const results: TestResult[] = [];

async function log(result: TestResult) {
  results.push(result);
  const icon = result.status === "pass" ? "✓" : result.status === "fail" ? "✗" : "⚠";
  console.log(`${icon} ${result.page}: ${result.message}`);
}

async function checkPage(page: Page, url: string, pageName: string, checks: {
  waitFor?: string;
  shouldNotContain?: string[];
  shouldContain?: string[];
  clickButtons?: string[];
}) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Check for error page
    const pageContent = await page.content();
    if (pageContent.includes("Application error") || pageContent.includes("500") || pageContent.includes("Internal Server Error")) {
      await log({ page: pageName, status: "fail", message: "Server error on page" });
      return false;
    }

    // Check for React error boundary
    if (pageContent.includes("Something went wrong") || pageContent.includes("Error:")) {
      await log({ page: pageName, status: "warning", message: "Possible error state on page" });
    }

    // Wait for specific element
    if (checks.waitFor) {
      try {
        await page.waitForSelector(checks.waitFor, { timeout: 10000 });
      } catch {
        await log({ page: pageName, status: "fail", message: `Element not found: ${checks.waitFor}` });
        return false;
      }
    }

    // Check should not contain
    for (const text of checks.shouldNotContain || []) {
      if (pageContent.includes(text)) {
        await log({ page: pageName, status: "fail", message: `Page contains unexpected: ${text}` });
        return false;
      }
    }

    // Check should contain
    for (const text of checks.shouldContain || []) {
      if (!pageContent.includes(text)) {
        await log({ page: pageName, status: "warning", message: `Page missing expected: ${text}` });
      }
    }

    // Click buttons to test interactions
    for (const buttonText of checks.clickButtons || []) {
      try {
        const button = page.getByRole("button", { name: buttonText });
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(500);
        }
      } catch {
        // Button might not exist, that's okay
      }
    }

    await log({ page: pageName, status: "pass", message: "Page loaded successfully" });
    return true;
  } catch (error) {
    await log({ page: pageName, status: "fail", message: `Error: ${error}` });
    return false;
  }
}

async function runManualQA() {
  console.log("=== BrickTrack Manual QA Test ===\n");
  console.log(`Testing against: ${BASE_URL}\n`);

  await clerkSetup();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await setupClerkTestingToken({ page });

  // ========== PUBLIC PAGES ==========
  console.log("\n--- PUBLIC PAGES ---\n");

  await checkPage(page, BASE_URL, "Landing Page", {
    waitFor: "text=Track smarter",
    shouldContain: ["BrickTrack", "Sign up"],
  });

  await checkPage(page, `${BASE_URL}/blog`, "Blog", {
    waitFor: "text=Blog",
    shouldContain: ["Property"],
  });

  await checkPage(page, `${BASE_URL}/changelog`, "Changelog", {
    waitFor: "text=Changelog",
  });

  await checkPage(page, `${BASE_URL}/feedback`, "Feedback", {
    waitFor: "text=Feature",
  });

  // ========== AUTHENTICATION ==========
  console.log("\n--- AUTHENTICATION ---\n");

  await page.goto(`${BASE_URL}/sign-in`);
  await page.waitForSelector('[data-clerk-component="SignIn"]', { timeout: 15000 });
  await log({ page: "Sign-in Page", status: "pass", message: "Clerk sign-in loaded" });

  // Login
  console.log("\nLogging in...");
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ timeout: 5000 });
  await passwordInput.fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 });
  console.log("Logged in successfully!\n");

  // ========== DASHBOARD PAGES ==========
  console.log("\n--- DASHBOARD PAGES ---\n");

  await checkPage(page, `${BASE_URL}/dashboard`, "Dashboard", {
    waitFor: "text=Welcome",
  });

  await checkPage(page, `${BASE_URL}/properties`, "Properties List", {
    waitFor: "text=Properties",
  });

  await checkPage(page, `${BASE_URL}/properties/new`, "Add Property", {
    waitFor: "text=Add",
  });

  await checkPage(page, `${BASE_URL}/transactions`, "Transactions", {
    waitFor: "text=Transactions",
  });

  await checkPage(page, `${BASE_URL}/transactions/review`, "Transaction Review", {
    waitFor: "text=Review",
  });

  await checkPage(page, `${BASE_URL}/banking`, "Banking", {
    waitFor: "text=Banking",
  });

  await checkPage(page, `${BASE_URL}/banking/connect`, "Bank Connect", {
    waitFor: "text=Connect",
  });

  await checkPage(page, `${BASE_URL}/loans`, "Loans", {
    waitFor: "text=Loans",
  });

  await checkPage(page, `${BASE_URL}/loans/new`, "New Loan", {
    waitFor: "text=Loan",
  });

  await checkPage(page, `${BASE_URL}/loans/compare`, "Loan Compare", {
    waitFor: "text=Compare",
  });

  await checkPage(page, `${BASE_URL}/portfolio`, "Portfolio", {
    waitFor: "text=Portfolio",
  });

  await checkPage(page, `${BASE_URL}/alerts`, "Alerts", {
    waitFor: "text=Alerts",
  });

  await checkPage(page, `${BASE_URL}/tasks`, "Tasks", {
    waitFor: "text=Tasks",
  });

  await checkPage(page, `${BASE_URL}/discover`, "Discover", {
    waitFor: "text=Discover",
  });

  await checkPage(page, `${BASE_URL}/entities`, "Entities", {
    waitFor: "text=Entities",
  });

  await checkPage(page, `${BASE_URL}/entities/new`, "New Entity", {
    waitFor: "text=Entity",
  });

  await checkPage(page, `${BASE_URL}/emails`, "Emails", {
    waitFor: "text=Emails",
  });

  await checkPage(page, `${BASE_URL}/export`, "Export", {
    waitFor: "text=Export",
  });

  // ========== REPORTS ==========
  console.log("\n--- REPORTS ---\n");

  await checkPage(page, `${BASE_URL}/reports`, "Reports Hub", {
    waitFor: "text=Reports",
  });

  await checkPage(page, `${BASE_URL}/reports/tax`, "Tax Report", {
    waitFor: "text=Tax",
  });

  await checkPage(page, `${BASE_URL}/reports/mytax`, "MyTax Report", {
    waitFor: "text=MyTax",
  });

  await checkPage(page, `${BASE_URL}/reports/portfolio`, "Portfolio Report", {
    waitFor: "text=Portfolio",
  });

  await checkPage(page, `${BASE_URL}/reports/cgt`, "CGT Report", {
    waitFor: "text=Capital",
  });

  await checkPage(page, `${BASE_URL}/reports/compliance`, "Compliance Report", {
    waitFor: "text=Compliance",
  });

  await checkPage(page, `${BASE_URL}/reports/forecast`, "Forecast", {
    waitFor: "text=Forecast",
  });

  await checkPage(page, `${BASE_URL}/reports/scenarios`, "Scenarios", {
    waitFor: "text=Scenarios",
  });

  await checkPage(page, `${BASE_URL}/reports/scenarios/new`, "New Scenario", {
    waitFor: "text=Scenario",
  });

  await checkPage(page, `${BASE_URL}/reports/brokers`, "Broker Reports", {
    waitFor: "text=Broker",
  });

  await checkPage(page, `${BASE_URL}/reports/tax-position`, "Tax Position", {
    waitFor: "text=Tax",
  });

  await checkPage(page, `${BASE_URL}/reports/yoy-comparison`, "YoY Comparison", {
    waitFor: "text=Year",
  });

  await checkPage(page, `${BASE_URL}/reports/audit-checks`, "Audit Checks", {
    waitFor: "text=Audit",
  });

  await checkPage(page, `${BASE_URL}/reports/share`, "Share Reports", {
    waitFor: "text=Share",
  });

  await checkPage(page, `${BASE_URL}/reports/export`, "Export Reports", {
    waitFor: "text=Export",
  });

  // ========== SETTINGS ==========
  console.log("\n--- SETTINGS ---\n");

  await checkPage(page, `${BASE_URL}/settings/team`, "Team Settings", {
    waitFor: "text=Team",
  });

  await checkPage(page, `${BASE_URL}/settings/billing`, "Billing", {
    waitFor: "text=Billing",
  });

  await checkPage(page, `${BASE_URL}/settings/integrations`, "Integrations", {
    waitFor: "text=Integrations",
  });

  await checkPage(page, `${BASE_URL}/settings/integrations/propertyme`, "PropertyMe", {
    waitFor: "text=PropertyMe",
  });

  await checkPage(page, `${BASE_URL}/settings/notifications`, "Notifications", {
    waitFor: "text=Notifications",
  });

  await checkPage(page, `${BASE_URL}/settings/refinance-alerts`, "Refinance Alerts", {
    waitFor: "text=Refinance",
  });

  await checkPage(page, `${BASE_URL}/settings/loan-packs`, "Loan Packs", {
    waitFor: "text=Loan",
  });

  await checkPage(page, `${BASE_URL}/settings/mobile`, "Mobile Settings", {
    waitFor: "text=Mobile",
  });

  await checkPage(page, `${BASE_URL}/settings/audit-log`, "Audit Log", {
    waitFor: "text=Audit",
  });

  await checkPage(page, `${BASE_URL}/settings/advisors`, "Advisors", {
    waitFor: "text=Advisors",
  });

  await checkPage(page, `${BASE_URL}/settings/referrals`, "Referrals", {
    waitFor: "text=Referral",
  });

  await checkPage(page, `${BASE_URL}/settings/support`, "Support", {
    waitFor: "text=Support",
  });

  await checkPage(page, `${BASE_URL}/settings/feature-requests`, "Feature Requests", {
    waitFor: "text=Feature",
  });

  await checkPage(page, `${BASE_URL}/settings/bug-reports`, "Bug Reports", {
    waitFor: "text=Bug",
  });

  // ========== SIDEBAR NAVIGATION ==========
  console.log("\n--- SIDEBAR NAVIGATION ---\n");

  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState("networkidle");

  const sidebarItems = [
    "Dashboard",
    "Properties",
    "Transactions",
    "Banking",
    "Loans",
    "Reports",
    "Tasks",
  ];

  for (const item of sidebarItems) {
    try {
      const link = page.getByRole("link", { name: item }).first();
      if (await link.isVisible({ timeout: 2000 })) {
        await log({ page: `Sidebar: ${item}`, status: "pass", message: "Link visible" });
      } else {
        await log({ page: `Sidebar: ${item}`, status: "fail", message: "Link not visible" });
      }
    } catch {
      await log({ page: `Sidebar: ${item}`, status: "fail", message: "Link not found" });
    }
  }

  // ========== BUTTON INTERACTIONS ==========
  console.log("\n--- BUTTON INTERACTIONS ---\n");

  // Test Add Property button
  await page.goto(`${BASE_URL}/properties`);
  await page.waitForLoadState("networkidle");
  try {
    const addBtn = page.getByRole("link", { name: /add property/i }).or(page.getByRole("button", { name: /add property/i }));
    if (await addBtn.isVisible({ timeout: 5000 })) {
      await addBtn.click();
      await page.waitForURL(/\/properties\/new/, { timeout: 5000 });
      await log({ page: "Add Property Button", status: "pass", message: "Navigation works" });
    }
  } catch {
    await log({ page: "Add Property Button", status: "warning", message: "Button not found or click failed" });
  }

  // Test transaction filters
  await page.goto(`${BASE_URL}/transactions`);
  await page.waitForLoadState("networkidle");
  try {
    const filterBtn = page.getByRole("button", { name: /filter/i });
    if (await filterBtn.isVisible({ timeout: 3000 })) {
      await filterBtn.click();
      await page.waitForTimeout(500);
      await log({ page: "Transaction Filter", status: "pass", message: "Filter button works" });
    }
  } catch {
    await log({ page: "Transaction Filter", status: "warning", message: "Filter button not found" });
  }

  await browser.close();

  // ========== SUMMARY ==========
  console.log("\n\n=== SUMMARY ===\n");

  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const warnings = results.filter(r => r.status === "warning").length;

  console.log(`Total: ${results.length}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`⚠ Warnings: ${warnings}`);

  if (failed > 0) {
    console.log("\n--- FAILURES ---\n");
    results.filter(r => r.status === "fail").forEach(r => {
      console.log(`  ${r.page}: ${r.message}`);
    });
  }

  if (warnings > 0) {
    console.log("\n--- WARNINGS ---\n");
    results.filter(r => r.status === "warning").forEach(r => {
      console.log(`  ${r.page}: ${r.message}`);
    });
  }
}

runManualQA().catch((error) => {
  console.error("Error running manual QA:", error);
  process.exit(1);
});
