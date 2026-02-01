import { test as base, Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import * as fs from "fs/promises";
import * as path from "path";

// Demo user credentials - set in .env.local or use defaults
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
  captureState: (name: string) => Promise<string>;
}

/**
 * Extended test fixture with demo account authentication and audit helpers.
 * Provides an `audit` context for capturing UI states and logging findings.
 */
export const test = base.extend<{ audit: AuditContext }>({
  audit: async ({ page }, use) => {
    const findings: AuditFinding[] = [];
    let currentPage = "/";

    // Set up Clerk testing token (bypasses bot detection)
    await setupClerkTestingToken({ page });

    // Sign in with demo account if credentials provided
    if (DEMO_USER_EMAIL && DEMO_USER_PASSWORD) {
      await page.goto("/sign-in");
      await page.waitForSelector('[data-clerk-component="SignIn"]', { timeout: 15000 });

      // Fill email
      await page.getByLabel(/email/i).fill(DEMO_USER_EMAIL);
      await page.getByRole("button", { name: "Continue", exact: true }).click();

      // Fill password
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.waitFor({ timeout: 5000 });
      await passwordInput.fill(DEMO_USER_PASSWORD);

      // Submit
      await page.getByRole("button", { name: "Continue", exact: true }).click();

      // Wait for redirect away from sign-in
      await page.waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 });
    }

    // Track page navigations to update currentPage
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        try {
          currentPage = new URL(frame.url()).pathname;
        } catch {
          // Ignore invalid URLs
        }
      }
    });

    // Create the audit context
    const context: AuditContext = {
      page,
      findings,

      addFinding: (finding) => {
        findings.push({
          ...finding,
          page: finding.page || currentPage,
        });
      },

      captureState: async (name: string): Promise<string> => {
        // Generate screenshot filename from current page and state name
        const pageName = currentPage.replace(/\//g, "-").slice(1) || "home";
        const screenshotName = `${pageName}-${name}.png`;
        const screenshotPath = path.join(
          process.cwd(),
          "e2e/ui-audit/results/screenshots",
          screenshotName
        );

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });

        return screenshotName;
      },
    };

    // Run the test with audit context
    await use(context);

    // After test: write findings to JSON
    if (findings.length > 0) {
      const auditLogPath = path.join(process.cwd(), "e2e/ui-audit/results/audit-log.json");

      // Read existing findings if file exists
      let existingFindings: AuditFinding[] = [];
      try {
        const existingData = await fs.readFile(auditLogPath, "utf-8");
        existingFindings = JSON.parse(existingData);
      } catch {
        // File doesn't exist yet, start fresh
      }

      // Merge and write
      const allFindings = [...existingFindings, ...findings];
      await fs.mkdir(path.dirname(auditLogPath), { recursive: true });
      await fs.writeFile(auditLogPath, JSON.stringify(allFindings, null, 2));
    }
  },
});

export { expect } from "@playwright/test";
