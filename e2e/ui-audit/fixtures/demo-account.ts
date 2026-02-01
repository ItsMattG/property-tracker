import { test as base, Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import * as fs from "fs/promises";
import * as path from "path";

// Demo user credentials - set in .env.local or use defaults
const DEMO_USER_EMAIL = process.env.E2E_DEMO_USER_EMAIL;
const DEMO_USER_PASSWORD = process.env.E2E_DEMO_USER_PASSWORD;

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
 * Creates audit context helpers for a page
 */
function createAuditContext(page: Page, findings: AuditFinding[]): AuditContext {
  let currentPage = "/";

  // Track page navigations
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      try {
        currentPage = new URL(frame.url()).pathname;
      } catch {
        // Ignore invalid URLs
      }
    }
  });

  return {
    page,
    findings,

    addFinding: (finding) => {
      findings.push({
        ...finding,
        page: finding.page || currentPage,
      });
    },

    captureState: async (name: string): Promise<string> => {
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
}

/**
 * Writes findings to the audit log after test completes
 */
async function writeFindings(findings: AuditFinding[]): Promise<void> {
  if (findings.length === 0) return;

  const auditLogPath = path.join(process.cwd(), "e2e/ui-audit/results/audit-log.json");

  let existingFindings: AuditFinding[] = [];
  try {
    const existingData = await fs.readFile(auditLogPath, "utf-8");
    existingFindings = JSON.parse(existingData);
  } catch {
    // File doesn't exist yet
  }

  const allFindings = [...existingFindings, ...findings];
  await fs.mkdir(path.dirname(auditLogPath), { recursive: true });
  await fs.writeFile(auditLogPath, JSON.stringify(allFindings, null, 2));
}

/**
 * Unauthenticated audit fixture for public pages
 */
export const test = base.extend<{ audit: AuditContext }>({
  audit: async ({ page }, use) => {
    const findings: AuditFinding[] = [];
    const context = createAuditContext(page, findings);
    await use(context);
    await writeFindings(findings);
  },
});

/**
 * Authenticated audit fixture for protected pages
 */
export const authenticatedTest = base.extend<{ audit: AuditContext }>({
  audit: async ({ page }, use) => {
    const findings: AuditFinding[] = [];

    // Set up Clerk testing token
    await setupClerkTestingToken({ page });

    // Sign in with demo account if credentials provided
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

    const context = createAuditContext(page, findings);
    await use(context);
    await writeFindings(findings);
  },
});

export { expect } from "@playwright/test";
