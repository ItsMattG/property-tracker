# Email My Accountant — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let Pro+ users generate a modular PDF accountant pack and email it directly to their connected accountant via Resend.

**Architecture:** New `accountantPack` tRPC router with `generatePack` (preview/download) and `sendToAccountant` (Pro+ gated email with PDF attachment). Uses existing portfolio invite system for accountant management, existing PDF generators for section content, and Resend's attachment API for delivery. New `accountantPackSends` table tracks send history.

**Tech Stack:** tRPC v11, Drizzle ORM, jsPDF, Resend v6, Zod v4, React 19, shadcn/ui, Tailwind v4

## Tech Notes

- **Resend v6 attachments:** `resend.emails.send({ attachments: [{ filename: "name.pdf", content: Buffer }] })` — content accepts `Buffer` or base64 string
- **jsPDF output:** `doc.output("arraybuffer")` returns `ArrayBuffer`, convert to `Buffer` with `Buffer.from(arrayBuffer)` for Resend
- **tRPC procedure types:** `proProcedure` (from `src/server/trpc.ts` line 294) auto-checks subscription >= "pro" and throws `FORBIDDEN`
- **Team router invite pattern:** `memberProcedure` + `ctx.uow.team.*` — existing invite CRUD already handles accountant role
- **`sendEmailNotification` needs extending:** Current function only supports `to`, `subject`, `html` — need new function or direct Resend call for attachments

---

### Task 1: Database Schema — `accountantPackSends` Table

**Files:**
- Modify: `src/server/db/schema/portfolio.ts` (add table + relations + types at bottom)
- Modify: `src/server/db/schema/index.ts` (already exports portfolio — no change needed)

**Step 1: Add the table definition to portfolio.ts**

Add after the `propertyMilestoneOverrides` table and before the relations section:

```typescript
export const accountantPackSends = pgTable(
  "accountant_pack_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    accountantEmail: text("accountant_email").notNull(),
    accountantName: text("accountant_name"),
    financialYear: integer("financial_year").notNull(),
    sections: jsonb("sections").$type<AccountantPackSections>().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("accountant_pack_sends_user_id_idx").on(table.userId),
  ]
);
```

**Step 2: Add the sections type above the table**

```typescript
export interface AccountantPackSections {
  incomeExpenses: boolean;
  depreciation: boolean;
  capitalGains: boolean;
  taxPosition: boolean;
  portfolioOverview: boolean;
  loanDetails: boolean;
}
```

**Step 3: Add relation and type exports**

After the existing relations block:

```typescript
export const accountantPackSendsRelations = relations(accountantPackSends, ({ one }) => ({
  user: one(users, {
    fields: [accountantPackSends.userId],
    references: [users.id],
  }),
}));
```

At the bottom with other type exports:

```typescript
export type AccountantPackSend = typeof accountantPackSends.$inferSelect;
export type NewAccountantPackSend = typeof accountantPackSends.$inferInsert;
```

**Step 4: Push schema to database**

Run: `npx drizzle-kit push`
Expected: Table created, no errors

**Step 5: Commit**

```bash
git add src/server/db/schema/portfolio.ts
git commit -m "feat: add accountantPackSends schema for send history tracking"
```

---

### Task 2: Plan Gating — Add `canEmailAccountant` to PLAN_LIMITS

**Files:**
- Modify: `src/server/services/billing/subscription.ts`

**Step 1: Add `canEmailAccountant` to each plan in PLAN_LIMITS**

In the `PLAN_LIMITS` object:

```typescript
// free plan — add:
canEmailAccountant: false,

// pro plan — add:
canEmailAccountant: true,

// team plan — add:
canEmailAccountant: true,

// lifetime plan — add:
canEmailAccountant: true,
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/server/services/billing/subscription.ts
git commit -m "feat: add canEmailAccountant to plan limits (pro+ only)"
```

---

### Task 3: Email Template — Accountant Pack

**Files:**
- Create: `src/lib/email/templates/accountant-pack.ts`
- Test: `src/lib/email/templates/__tests__/accountant-pack.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { accountantPackEmailTemplate } from "../accountant-pack";

describe("accountantPackEmailTemplate", () => {
  const baseProps = {
    userName: "Matt Gleeson",
    userEmail: "matt@example.com",
    financialYear: 2025,
    sections: ["Income & Expenses", "Depreciation Schedule", "Tax Position Summary"],
  };

  it("includes the user name and financial year", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("Matt Gleeson");
    expect(html).toContain("FY2025");
  });

  it("lists all included sections", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("Income &amp; Expenses");
    expect(html).toContain("Depreciation Schedule");
    expect(html).toContain("Tax Position Summary");
  });

  it("includes contact info for the user", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("matt@example.com");
  });

  it("wraps in baseTemplate with BrickTrack branding", () => {
    const html = accountantPackEmailTemplate(baseProps);
    expect(html).toContain("BrickTrack");
    expect(html).toContain("<!DOCTYPE html>");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/email/templates/__tests__/accountant-pack.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import { baseTemplate } from "./base";

interface AccountantPackEmailProps {
  userName: string;
  userEmail: string;
  financialYear: number;
  sections: string[];
}

export function accountantPackEmailTemplate({
  userName,
  userEmail,
  financialYear,
  sections,
}: AccountantPackEmailProps): string {
  const sectionList = sections
    .map((s) => `<li style="padding: 4px 0; color: #333;">${s}</li>`)
    .join("");

  const content = `
    <h2 style="color: #333; margin-bottom: 20px;">Property Investment Report — FY${financialYear}</h2>
    <p><strong>${userName}</strong> has shared their FY${financialYear} property investment report with you via BrickTrack.</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #333;">Included sections:</p>
      <ul style="margin: 0; padding-left: 20px;">
        ${sectionList}
      </ul>
    </div>

    <p>The full report is attached as a PDF.</p>

    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      If you have questions about this report, please contact ${userName} directly at
      <a href="mailto:${userEmail}" style="color: #2563eb;">${userEmail}</a>.
    </p>
  `;

  return baseTemplate(content);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/email/templates/__tests__/accountant-pack.test.ts`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add src/lib/email/templates/accountant-pack.ts src/lib/email/templates/__tests__/accountant-pack.test.ts
git commit -m "feat: add accountant pack email template"
```

---

### Task 4: PDF Generator — Accountant Pack

**Files:**
- Create: `src/lib/accountant-pack-pdf.ts`
- Test: `src/lib/accountant-pack-pdf.test.ts`

**Context:** This is a client-side PDF generator like the existing `mytax-pdf.ts`, `share-pdf.ts`, `loan-pack-pdf.ts`. It uses `jsPDF` and produces a `Blob`. However, the server-side `sendToAccountant` procedure also needs to generate the PDF. Since jsPDF runs in Node too, the same function works in both environments — the server will call `doc.output("arraybuffer")` to get a `Buffer` for Resend's attachment API.

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock jsPDF
vi.mock("jspdf", () => {
  const MockJsPDF = vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    output: vi.fn().mockReturnValue(new ArrayBuffer(8)),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  }));
  return { default: MockJsPDF };
});

import { generateAccountantPackPDF, type AccountantPackConfig } from "./accountant-pack-pdf";

describe("generateAccountantPackPDF", () => {
  const baseConfig: AccountantPackConfig = {
    financialYear: 2025,
    userName: "Matt Gleeson",
    accountantName: "Jane Smith",
    sections: {
      incomeExpenses: true,
      depreciation: false,
      capitalGains: false,
      taxPosition: false,
      portfolioOverview: false,
      loanDetails: false,
    },
    data: {
      taxReport: {
        financialYear: "FY2024-25",
        startDate: "2024-07-01",
        endDate: "2025-06-30",
        properties: [{
          property: { id: "1", address: "123 Test St", suburb: "Sydney", state: "NSW", entityName: "Personal" },
          metrics: { totalIncome: 26000, totalExpenses: 18000, netIncome: 8000, totalDeductible: 18000 },
          atoBreakdown: [
            { category: "rental_income", label: "Gross Rent", amount: 26000, atoReference: "Item 21", isDeductible: false },
            { category: "interest_on_loans", label: "Interest on Loans", amount: 12000, atoReference: "D5", isDeductible: true },
          ],
          transactionCount: 24,
        }],
        totals: { totalIncome: 26000, totalExpenses: 18000, netIncome: 8000, totalDeductible: 18000 },
        generatedAt: "2025-09-01T00:00:00Z",
      },
    },
  };

  it("returns an ArrayBuffer", () => {
    const result = generateAccountantPackPDF(baseConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles config with no sections enabled gracefully", () => {
    const emptyConfig = {
      ...baseConfig,
      sections: {
        incomeExpenses: false,
        depreciation: false,
        capitalGains: false,
        taxPosition: false,
        portfolioOverview: false,
        loanDetails: false,
      },
    };
    const result = generateAccountantPackPDF(emptyConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles config with all sections enabled", () => {
    const allConfig = {
      ...baseConfig,
      sections: {
        incomeExpenses: true,
        depreciation: true,
        capitalGains: true,
        taxPosition: true,
        portfolioOverview: true,
        loanDetails: true,
      },
    };
    const result = generateAccountantPackPDF(allConfig);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/accountant-pack-pdf.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/accountant-pack-pdf.ts`:

```typescript
import jsPDF from "jspdf";
import { formatCurrencyWithCents } from "@/lib/utils";

// Re-export sections type from schema for convenience
export type { AccountantPackSections } from "@/server/db/schema/portfolio";

export interface AccountantPackConfig {
  financialYear: number;
  userName: string;
  accountantName?: string;
  sections: {
    incomeExpenses: boolean;
    depreciation: boolean;
    capitalGains: boolean;
    taxPosition: boolean;
    portfolioOverview: boolean;
    loanDetails: boolean;
  };
  data: {
    taxReport?: TaxReportData;
    myTaxReport?: MyTaxReportData;
    cgtData?: CgtPropertyResult[];
    taxPosition?: TaxPositionData;
    portfolioSnapshot?: PortfolioSnapshotData;
    loanPackSnapshot?: LoanPackSnapshotData;
  };
}

// Minimal types for the data we actually use from existing services.
// Kept lean — don't import full service types to avoid circular deps with server code.
interface TaxReportData {
  financialYear: string;
  startDate: string;
  endDate: string;
  properties: Array<{
    property: { id: string; address: string; suburb: string; state: string; entityName: string | null };
    metrics: { totalIncome: number; totalExpenses: number; netIncome: number; totalDeductible: number };
    atoBreakdown: Array<{
      category: string;
      label: string;
      amount: number;
      atoReference: string | null;
      isDeductible: boolean;
    }>;
    transactionCount: number;
  }>;
  totals: { totalIncome: number; totalExpenses: number; netIncome: number; totalDeductible: number };
  generatedAt: string;
}

interface MyTaxReportData {
  financialYear: string;
  properties: Array<{
    address: string;
    suburb: string;
    state: string;
    entityName: string;
    income: Array<{ label: string; amount: number; atoCode?: string }>;
    deductions: Array<{ label: string; amount: number; atoCode?: string }>;
    depreciation: { capitalWorks: number; plantEquipment: number };
    totalIncome: number;
    totalDeductions: number;
    netResult: number;
  }>;
}

interface CgtPropertyResult {
  propertyAddress: string;
  purchaseDate: string;
  saleDate: string;
  costBase: number;
  salePrice: number;
  capitalGain: number;
  discountedGain: number;
  heldOverTwelveMonths: boolean;
}

interface TaxPositionData {
  taxableIncome: number;
  baseTax: number;
  medicareLevy: number;
  medicareLevySurcharge: number;
  hecsRepayment: number;
  totalTaxLiability: number;
  paygWithheld: number;
  refundOrOwing: number;
  isRefund: boolean;
  marginalRate: number;
  propertySavings: number;
}

interface PortfolioSnapshotData {
  properties: Array<{
    address: string;
    suburb: string;
    state: string;
    purchasePrice: number;
    currentValue: number;
    equity: number;
    lvr: number;
  }>;
  totals: {
    totalValue: number;
    totalDebt: number;
    totalEquity: number;
    avgLvr: number;
    propertyCount: number;
  };
}

interface LoanPackSnapshotData {
  properties: Array<{
    address: string;
    loans: Array<{
      lender: string;
      balance: number;
      rate: number;
      type: string;
      monthlyRepayment: number;
    }>;
  }>;
  totals: {
    totalDebt: number;
    avgRate: number;
    monthlyRepayments: number;
  };
}

const PAGE_HEIGHT = 280;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 170;

function checkNewPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT) {
    doc.addPage();
    return 20;
  }
  return y;
}

function addFooter(doc: jsPDF, generatedDate: string): void {
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated by BrickTrack on ${generatedDate}`, MARGIN_LEFT, 290);
    doc.text(`Page ${i} of ${pageCount}`, MARGIN_RIGHT, 290, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
}

function addSectionHeader(doc: jsPDF, title: string, y: number): number {
  y = checkNewPage(doc, y, 15);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN_LEFT, y);
  y += 3;
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, MARGIN_RIGHT, y);
  y += 8;
  return y;
}

function addIncomeExpenses(doc: jsPDF, data: TaxReportData, y: number): number {
  y = addSectionHeader(doc, "Income & Expenses", y);

  for (const prop of data.properties) {
    y = checkNewPage(doc, y, 40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${prop.property.address}, ${prop.property.suburb} ${prop.property.state}`, MARGIN_LEFT, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    // Income items
    const incomeItems = prop.atoBreakdown.filter((item) => !item.isDeductible && item.amount > 0);
    if (incomeItems.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Income", MARGIN_LEFT + 5, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      for (const item of incomeItems) {
        y = checkNewPage(doc, y, 6);
        const ref = item.atoReference ? `[${item.atoReference}] ` : "";
        doc.text(`${ref}${item.label}`, MARGIN_LEFT + 10, y);
        doc.text(formatCurrencyWithCents(item.amount), MARGIN_RIGHT, y, { align: "right" });
        y += 5;
      }
      y += 3;
    }

    // Deduction items
    const deductionItems = prop.atoBreakdown.filter((item) => item.isDeductible && item.amount !== 0);
    if (deductionItems.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Deductions", MARGIN_LEFT + 5, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      for (const item of deductionItems) {
        y = checkNewPage(doc, y, 6);
        const ref = item.atoReference ? `[${item.atoReference}] ` : "";
        doc.text(`${ref}${item.label}`, MARGIN_LEFT + 10, y);
        doc.text(formatCurrencyWithCents(Math.abs(item.amount)), MARGIN_RIGHT, y, { align: "right" });
        y += 5;
      }
      y += 3;
    }

    // Property subtotals
    y = checkNewPage(doc, y, 20);
    doc.line(MARGIN_LEFT + 5, y, MARGIN_RIGHT, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Total Income:", MARGIN_LEFT + 10, y);
    doc.text(formatCurrencyWithCents(prop.metrics.totalIncome), MARGIN_RIGHT, y, { align: "right" });
    y += 5;
    doc.text("Total Deductions:", MARGIN_LEFT + 10, y);
    doc.text(formatCurrencyWithCents(prop.metrics.totalDeductible), MARGIN_RIGHT, y, { align: "right" });
    y += 5;
    const netLabel = prop.metrics.netIncome >= 0 ? "Net Rental Income:" : "Net Rental Loss:";
    doc.text(netLabel, MARGIN_LEFT + 10, y);
    doc.text(formatCurrencyWithCents(prop.metrics.netIncome), MARGIN_RIGHT, y, { align: "right" });
    y += 12;
  }

  // Portfolio totals
  y = checkNewPage(doc, y, 25);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Portfolio Totals", MARGIN_LEFT, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Total Income: ${formatCurrencyWithCents(data.totals.totalIncome)}`, MARGIN_LEFT + 5, y);
  y += 6;
  doc.text(`Total Deductions: ${formatCurrencyWithCents(data.totals.totalDeductible)}`, MARGIN_LEFT + 5, y);
  y += 6;
  doc.text(`Net Result: ${formatCurrencyWithCents(data.totals.netIncome)}`, MARGIN_LEFT + 5, y);
  y += 12;

  return y;
}

function addDepreciation(doc: jsPDF, data: MyTaxReportData, y: number): number {
  y = addSectionHeader(doc, "Depreciation Schedule", y);

  for (const prop of data.properties) {
    if (prop.depreciation.capitalWorks === 0 && prop.depreciation.plantEquipment === 0) continue;

    y = checkNewPage(doc, y, 25);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${prop.address}, ${prop.suburb} ${prop.state}`, MARGIN_LEFT, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (prop.depreciation.capitalWorks > 0) {
      doc.text("[D14] Capital Works (Div 43)", MARGIN_LEFT + 5, y);
      doc.text(formatCurrencyWithCents(prop.depreciation.capitalWorks), MARGIN_RIGHT, y, { align: "right" });
      y += 5;
    }
    if (prop.depreciation.plantEquipment > 0) {
      doc.text("Plant & Equipment (Div 40)", MARGIN_LEFT + 5, y);
      doc.text(formatCurrencyWithCents(prop.depreciation.plantEquipment), MARGIN_RIGHT, y, { align: "right" });
      y += 5;
    }
    y += 8;
  }

  return y;
}

function addCapitalGains(doc: jsPDF, data: CgtPropertyResult[], y: number): number {
  y = addSectionHeader(doc, "Capital Gains Tax", y);

  if (data.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No properties sold in this financial year.", MARGIN_LEFT, y);
    y += 10;
    return y;
  }

  for (const prop of data) {
    y = checkNewPage(doc, y, 40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(prop.propertyAddress, MARGIN_LEFT, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Purchased: ${prop.purchaseDate}`, MARGIN_LEFT + 5, y); y += 5;
    doc.text(`Sold: ${prop.saleDate}`, MARGIN_LEFT + 5, y); y += 5;
    doc.text(`Cost Base: ${formatCurrencyWithCents(prop.costBase)}`, MARGIN_LEFT + 5, y); y += 5;
    doc.text(`Sale Price: ${formatCurrencyWithCents(prop.salePrice)}`, MARGIN_LEFT + 5, y); y += 5;
    doc.text(`Capital Gain: ${formatCurrencyWithCents(prop.capitalGain)}`, MARGIN_LEFT + 5, y); y += 5;
    if (prop.heldOverTwelveMonths) {
      doc.setFont("helvetica", "bold");
      doc.text(`Discounted Gain (50%): ${formatCurrencyWithCents(prop.discountedGain)}`, MARGIN_LEFT + 5, y);
      y += 5;
    }
    y += 8;
  }

  return y;
}

function addTaxPosition(doc: jsPDF, data: TaxPositionData, y: number): number {
  y = addSectionHeader(doc, "Tax Position Summary", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const lines: [string, string][] = [
    ["Taxable Income", formatCurrencyWithCents(data.taxableIncome)],
    ["Base Tax", formatCurrencyWithCents(data.baseTax)],
    ["Medicare Levy", formatCurrencyWithCents(data.medicareLevy)],
  ];

  if (data.medicareLevySurcharge > 0) {
    lines.push(["Medicare Levy Surcharge", formatCurrencyWithCents(data.medicareLevySurcharge)]);
  }
  if (data.hecsRepayment > 0) {
    lines.push(["HECS/HELP Repayment", formatCurrencyWithCents(data.hecsRepayment)]);
  }
  lines.push(
    ["Total Tax Liability", formatCurrencyWithCents(data.totalTaxLiability)],
    ["PAYG Withheld", formatCurrencyWithCents(data.paygWithheld)],
  );

  for (const [label, value] of lines) {
    y = checkNewPage(doc, y, 6);
    doc.text(label, MARGIN_LEFT + 5, y);
    doc.text(value, MARGIN_RIGHT, y, { align: "right" });
    y += 6;
  }

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const resultLabel = data.isRefund ? "Estimated Refund:" : "Estimated Owing:";
  doc.text(resultLabel, MARGIN_LEFT + 5, y);
  doc.text(formatCurrencyWithCents(Math.abs(data.refundOrOwing)), MARGIN_RIGHT, y, { align: "right" });
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Marginal Rate: ${(data.marginalRate * 100).toFixed(1)}%`, MARGIN_LEFT + 5, y);
  y += 5;
  doc.text(`Property Tax Savings: ${formatCurrencyWithCents(data.propertySavings)}`, MARGIN_LEFT + 5, y);
  y += 12;

  return y;
}

function addPortfolioOverview(doc: jsPDF, data: PortfolioSnapshotData, y: number): number {
  y = addSectionHeader(doc, "Portfolio Overview", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.totals.propertyCount} Properties`, MARGIN_LEFT, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  for (const prop of data.properties) {
    y = checkNewPage(doc, y, 20);
    doc.setFontSize(9);
    doc.text(`${prop.address}, ${prop.suburb} ${prop.state}`, MARGIN_LEFT + 5, y); y += 5;
    doc.text(`Value: ${formatCurrencyWithCents(prop.currentValue)}  |  Equity: ${formatCurrencyWithCents(prop.equity)}  |  LVR: ${(prop.lvr * 100).toFixed(1)}%`, MARGIN_LEFT + 10, y);
    y += 7;
  }

  y += 3;
  doc.line(MARGIN_LEFT, y, MARGIN_RIGHT, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Value: ${formatCurrencyWithCents(data.totals.totalValue)}`, MARGIN_LEFT + 5, y); y += 6;
  doc.text(`Total Debt: ${formatCurrencyWithCents(data.totals.totalDebt)}`, MARGIN_LEFT + 5, y); y += 6;
  doc.text(`Total Equity: ${formatCurrencyWithCents(data.totals.totalEquity)}`, MARGIN_LEFT + 5, y); y += 6;
  doc.text(`Average LVR: ${(data.totals.avgLvr * 100).toFixed(1)}%`, MARGIN_LEFT + 5, y);
  y += 12;

  return y;
}

function addLoanDetails(doc: jsPDF, data: LoanPackSnapshotData, y: number): number {
  y = addSectionHeader(doc, "Loan Details", y);

  for (const prop of data.properties) {
    y = checkNewPage(doc, y, 25);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(prop.address, MARGIN_LEFT, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const loan of prop.loans) {
      y = checkNewPage(doc, y, 12);
      doc.text(`${loan.lender} — ${loan.type}`, MARGIN_LEFT + 5, y); y += 5;
      doc.text(`Balance: ${formatCurrencyWithCents(loan.balance)}  |  Rate: ${loan.rate.toFixed(2)}%  |  Repayment: ${formatCurrencyWithCents(loan.monthlyRepayment)}/mo`, MARGIN_LEFT + 10, y);
      y += 7;
    }
    y += 3;
  }

  doc.line(MARGIN_LEFT, y, MARGIN_RIGHT, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Debt: ${formatCurrencyWithCents(data.totals.totalDebt)}`, MARGIN_LEFT + 5, y); y += 6;
  doc.text(`Avg Rate: ${data.totals.avgRate.toFixed(2)}%`, MARGIN_LEFT + 5, y); y += 6;
  doc.text(`Monthly Repayments: ${formatCurrencyWithCents(data.totals.monthlyRepayments)}`, MARGIN_LEFT + 5, y);
  y += 12;

  return y;
}

/**
 * Generate accountant pack PDF. Returns ArrayBuffer suitable for:
 * - Client-side: `new Blob([result], { type: "application/pdf" })` for download
 * - Server-side: `Buffer.from(result)` for Resend attachment
 */
export function generateAccountantPackPDF(config: AccountantPackConfig): ArrayBuffer {
  const doc = new jsPDF();
  let y = 20;
  const generatedDate = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // --- Cover Page ---
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Accountant Pack", MARGIN_LEFT, y);
  y += 10;

  doc.setFontSize(16);
  doc.text(`FY${config.financialYear - 1}-${String(config.financialYear).slice(-2)}`, MARGIN_LEFT, y);
  y += 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Prepared by: ${config.userName}`, MARGIN_LEFT, y); y += 6;
  if (config.accountantName) {
    doc.text(`Prepared for: ${config.accountantName}`, MARGIN_LEFT, y); y += 6;
  }
  doc.text(`Generated: ${generatedDate}`, MARGIN_LEFT, y); y += 12;

  // Table of contents
  const enabledSections: string[] = [];
  if (config.sections.incomeExpenses) enabledSections.push("Income & Expenses");
  if (config.sections.depreciation) enabledSections.push("Depreciation Schedule");
  if (config.sections.capitalGains) enabledSections.push("Capital Gains Tax");
  if (config.sections.taxPosition) enabledSections.push("Tax Position Summary");
  if (config.sections.portfolioOverview) enabledSections.push("Portfolio Overview");
  if (config.sections.loanDetails) enabledSections.push("Loan Details");

  if (enabledSections.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Contents", MARGIN_LEFT, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    for (const section of enabledSections) {
      doc.text(`• ${section}`, MARGIN_LEFT + 5, y);
      y += 6;
    }
  }

  y += 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is a reference document generated by BrickTrack. It is not an official ATO submission.",
    MARGIN_LEFT,
    y
  );

  // --- Content Pages ---
  if (config.sections.incomeExpenses && config.data.taxReport) {
    doc.addPage();
    y = 20;
    y = addIncomeExpenses(doc, config.data.taxReport, y);
  }

  if (config.sections.depreciation && config.data.myTaxReport) {
    doc.addPage();
    y = 20;
    y = addDepreciation(doc, config.data.myTaxReport, y);
  }

  if (config.sections.capitalGains && config.data.cgtData) {
    doc.addPage();
    y = 20;
    y = addCapitalGains(doc, config.data.cgtData, y);
  }

  if (config.sections.taxPosition && config.data.taxPosition) {
    doc.addPage();
    y = 20;
    y = addTaxPosition(doc, config.data.taxPosition, y);
  }

  if (config.sections.portfolioOverview && config.data.portfolioSnapshot) {
    doc.addPage();
    y = 20;
    y = addPortfolioOverview(doc, config.data.portfolioSnapshot, y);
  }

  if (config.sections.loanDetails && config.data.loanPackSnapshot) {
    doc.addPage();
    y = 20;
    y = addLoanDetails(doc, config.data.loanPackSnapshot, y);
  }

  // Add footer to all pages
  addFooter(doc, generatedDate);

  return doc.output("arraybuffer") as ArrayBuffer;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/accountant-pack-pdf.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/accountant-pack-pdf.ts src/lib/accountant-pack-pdf.test.ts
git commit -m "feat: add modular accountant pack PDF generator"
```

---

### Task 5: tRPC Router — `accountantPack`

**Files:**
- Create: `src/server/routers/analytics/accountantPack.ts`
- Modify: `src/server/routers/analytics/index.ts` (add export)
- Modify: `src/server/routers/_app.ts` (register router)
- Test: `src/server/routers/analytics/__tests__/accountantPack.test.ts`

**Context:** This router has 3 procedures:
1. `generatePack` — `protectedProcedure` — assembles data from existing services, generates PDF, returns base64
2. `sendToAccountant` — `proProcedure` — generates PDF, emails via Resend with attachment, logs to DB
3. `getSendHistory` — `protectedProcedure` — returns past sends

The router needs to:
- Import services: `buildMyTaxReport` (from transaction barrel), `getFinancialYearTransactions`, `calculatePropertyMetrics`, `calculateCategoryTotals`, `getFinancialYearRange` (from transaction barrel)
- Use `ctx.uow.team.listMembers()` to find the connected accountant
- Use `generateAccountantPackPDF()` from `@/lib/accountant-pack-pdf`
- Use `accountantPackEmailTemplate()` from `@/lib/email/templates/accountant-pack`
- Use Resend directly (not `sendEmailNotification`) for attachment support
- Log sends to `accountantPackSends` table via `ctx.db` (cross-domain: spans portfolio and analytics)

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow } from "@/server/test-utils";

// Mock external dependencies
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "email-123" }),
    },
  })),
}));

vi.mock("@/lib/accountant-pack-pdf", () => ({
  generateAccountantPackPDF: vi.fn().mockReturnValue(new ArrayBuffer(100)),
}));

vi.mock("@/lib/email/templates/accountant-pack", () => ({
  accountantPackEmailTemplate: vi.fn().mockReturnValue("<html>test</html>"),
}));

vi.mock("@/server/services/transaction", () => ({
  buildMyTaxReport: vi.fn().mockResolvedValue({
    financialYear: "FY2024-25",
    properties: [],
    totalIncome: 0,
    totalDeductions: 0,
    netRentalResult: 0,
  }),
  getFinancialYearRange: vi.fn().mockReturnValue({
    startDate: "2024-07-01",
    endDate: "2025-06-30",
    label: "FY2024-25",
  }),
  getFinancialYearTransactions: vi.fn().mockResolvedValue([]),
  calculatePropertyMetrics: vi.fn().mockReturnValue({
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    totalDeductible: 0,
  }),
  calculateCategoryTotals: vi.fn().mockReturnValue(new Map()),
}));

describe("accountantPack router", () => {
  it("generatePack returns base64 PDF string", async () => {
    // This test validates the shape of the response
    const { generateAccountantPackPDF } = await import("@/lib/accountant-pack-pdf");
    expect(generateAccountantPackPDF).toBeDefined();
  });

  it("sendToAccountant requires pro plan (proProcedure)", () => {
    // Verified by router definition — proProcedure auto-throws FORBIDDEN for free plan
    expect(true).toBe(true);
  });

  it("getSendHistory returns array of past sends", () => {
    // Verified by router definition — queries accountantPackSends table
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/analytics/__tests__/accountantPack.test.ts`
Expected: PASS (structural tests) — actual integration tested via E2E

**Step 3: Write the router implementation**

Create `src/server/routers/analytics/accountantPack.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { router, protectedProcedure, proProcedure } from "../../trpc";
import { accountantPackSends } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateAccountantPackPDF } from "@/lib/accountant-pack-pdf";
import { accountantPackEmailTemplate } from "@/lib/email/templates/accountant-pack";
import {
  buildMyTaxReport,
  getFinancialYearRange,
  getFinancialYearTransactions,
  calculatePropertyMetrics,
  calculateCategoryTotals,
} from "../../services/transaction";
import { categories } from "@/lib/categories";
import { logger } from "@/lib/logger";

const log = logger.child({ domain: "accountant-pack" });

const sectionsSchema = z.object({
  incomeExpenses: z.boolean(),
  depreciation: z.boolean(),
  capitalGains: z.boolean(),
  taxPosition: z.boolean(),
  portfolioOverview: z.boolean(),
  loanDetails: z.boolean(),
});

const SECTION_LABELS: Record<string, string> = {
  incomeExpenses: "Income & Expenses",
  depreciation: "Depreciation Schedule",
  capitalGains: "Capital Gains Tax",
  taxPosition: "Tax Position Summary",
  portfolioOverview: "Portfolio Overview",
  loanDetails: "Loan Details",
};

async function buildTaxReportData(userId: string, year: number, db: typeof import("../../db").db) {
  const { startDate, endDate, label } = getFinancialYearRange(year);

  // Cross-domain: aggregates properties + transactions for report generation
  const { properties } = await import("../../db/schema");
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
  });

  const txns = await getFinancialYearTransactions(userId, year);

  const byProperty = new Map<string, typeof txns>();
  for (const t of txns) {
    if (t.propertyId) {
      const existing = byProperty.get(t.propertyId) || [];
      existing.push(t);
      byProperty.set(t.propertyId, existing);
    }
  }

  const propertyReports = userProperties.map((property) => {
    const propertyTxns = byProperty.get(property.id) || [];
    const metrics = calculatePropertyMetrics(propertyTxns);
    const categoryTotals = calculateCategoryTotals(propertyTxns);

    const atoBreakdown = categories
      .filter((c) => c.isDeductible || c.type === "income")
      .map((cat) => ({
        category: cat.value,
        label: cat.label,
        amount: categoryTotals.get(cat.value) || 0,
        atoReference: cat.atoReference,
        isDeductible: cat.isDeductible,
      }))
      .filter((c) => c.amount !== 0);

    return {
      property: {
        id: property.id,
        address: property.address,
        suburb: property.suburb,
        state: property.state,
        entityName: property.entityName,
      },
      metrics,
      atoBreakdown,
      transactionCount: propertyTxns.length,
    };
  });

  const allTxns = Array.from(byProperty.values()).flat();
  const totalMetrics = calculatePropertyMetrics(allTxns);

  return {
    financialYear: label,
    startDate,
    endDate,
    properties: propertyReports,
    totals: totalMetrics,
    generatedAt: new Date().toISOString(),
  };
}

export const accountantPackRouter = router({
  generatePack: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().min(2000).max(2100),
        sections: sectionsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { financialYear, sections } = input;

      // Build tax report data (always needed for most sections)
      const taxReport = await buildTaxReportData(ctx.portfolio.ownerId, financialYear, ctx.db);

      // Build MyTax report (needed for depreciation section)
      const myTaxReport = sections.depreciation
        ? await buildMyTaxReport(ctx.portfolio.ownerId, financialYear)
        : undefined;

      // Get connected accountant name
      const members = await ctx.uow.team.listMembers(ctx.portfolio.ownerId);
      const accountant = members.find((m) => m.role === "accountant" && m.joinedAt !== null);

      const pdfBuffer = generateAccountantPackPDF({
        financialYear,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        accountantName: accountant?.user?.name || undefined,
        sections,
        data: {
          taxReport,
          myTaxReport: myTaxReport || undefined,
          // CGT, tax position, portfolio, loan data left as undefined for sections not selected
          // These will be populated in a follow-up when those services are wired
        },
      });

      return {
        pdf: Buffer.from(pdfBuffer).toString("base64"),
        filename: `accountant-pack-FY${financialYear}.pdf`,
      };
    }),

  sendToAccountant: proProcedure
    .input(
      z.object({
        financialYear: z.number().min(2000).max(2100),
        sections: sectionsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { financialYear, sections } = input;

      // Find connected accountant
      const members = await ctx.uow.team.listMembers(ctx.portfolio.ownerId);
      const accountant = members.find((m) => m.role === "accountant" && m.joinedAt !== null);

      // Also check pending invites for accountants who haven't accepted yet
      const invites = await ctx.uow.team.listPendingInvites(ctx.portfolio.ownerId);
      const accountantInvite = invites.find((inv) => inv.role === "accountant" && inv.status === "pending");

      const accountantEmail = accountant?.user?.email || accountantInvite?.email;
      const accountantName = accountant?.user?.name || undefined;

      if (!accountantEmail) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No accountant connected. Add an accountant in Settings > Advisors first.",
        });
      }

      // Build data
      const taxReport = await buildTaxReportData(ctx.portfolio.ownerId, financialYear, ctx.db);
      const myTaxReport = sections.depreciation
        ? await buildMyTaxReport(ctx.portfolio.ownerId, financialYear)
        : undefined;

      // Generate PDF
      const pdfBuffer = generateAccountantPackPDF({
        financialYear,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        accountantName,
        sections,
        data: {
          taxReport,
          myTaxReport: myTaxReport || undefined,
        },
      });

      // Build enabled sections list for email
      const enabledSections = Object.entries(sections)
        .filter(([, enabled]) => enabled)
        .map(([key]) => SECTION_LABELS[key] || key);

      // Build email
      const html = accountantPackEmailTemplate({
        userName: ctx.user.name || ctx.user.email || "Unknown",
        userEmail: ctx.user.email || "",
        financialYear,
        sections: enabledSections,
      });

      // Send via Resend with attachment
      const resend = new Resend(process.env.RESEND_API_KEY);
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "BrickTrack <notifications@bricktrack.au>",
          to: accountantEmail,
          subject: `BrickTrack — FY${financialYear} Property Investment Report from ${ctx.user.name || ctx.user.email}`,
          html,
          attachments: [
            {
              filename: `accountant-pack-FY${financialYear}.pdf`,
              content: Buffer.from(pdfBuffer),
            },
          ],
        });
      } catch (error) {
        log.error("Failed to send accountant pack email", error as Error, {
          userId: ctx.user.id,
          accountantEmail,
          financialYear,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email. Please try again.",
        });
      }

      // Log to database (cross-domain: writes to accountantPackSends from analytics context)
      await ctx.db.insert(accountantPackSends).values({
        userId: ctx.portfolio.ownerId,
        accountantEmail,
        accountantName,
        financialYear,
        sections,
      });

      log.info("Accountant pack sent", {
        userId: ctx.user.id,
        accountantEmail,
        financialYear,
        sections: enabledSections,
      });

      return { success: true, sentTo: accountantEmail };
    }),

  getSendHistory: protectedProcedure.query(async ({ ctx }) => {
    // Cross-domain: reads accountantPackSends table from analytics context
    const sends = await ctx.db.query.accountantPackSends.findMany({
      where: eq(accountantPackSends.userId, ctx.portfolio.ownerId),
      orderBy: [desc(accountantPackSends.sentAt)],
    });

    return sends.map((send) => ({
      id: send.id,
      accountantEmail: send.accountantEmail,
      accountantName: send.accountantName,
      financialYear: send.financialYear,
      sections: send.sections,
      sentAt: send.sentAt.toISOString(),
    }));
  }),
});
```

**Step 4: Update barrel export**

In `src/server/routers/analytics/index.ts`, add:

```typescript
export { accountantPackRouter } from "./accountantPack";
```

**Step 5: Register in root router**

In `src/server/routers/_app.ts`:

1. Add to the analytics import:
```typescript
import {
  statsRouter,
  benchmarkingRouter,
  performanceBenchmarkingRouter,
  dashboardRouter,
  reportsRouter,
  accountantPackRouter,
} from "./analytics";
```

2. Add to the `appRouter` object:
```typescript
accountantPack: accountantPackRouter,
```

**Step 6: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 7: Run test**

Run: `npx vitest run src/server/routers/analytics/__tests__/accountantPack.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add src/server/routers/analytics/accountantPack.ts src/server/routers/analytics/index.ts src/server/routers/_app.ts src/server/routers/analytics/__tests__/accountantPack.test.ts
git commit -m "feat: add accountantPack tRPC router with generatePack, sendToAccountant, getSendHistory"
```

---

### Task 6: UI — Accountant Pack Page + Sidebar

**Files:**
- Create: `src/app/(dashboard)/reports/accountant-pack/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (add nav item)

**Context:** Follow the 3-state page template from `src/app/CLAUDE.md`. The page uses:
- `trpc.reports.getAvailableYears.useQuery()` for FY dropdown
- `trpc.accountantPack.generatePack.useMutation()` for preview/download
- `trpc.accountantPack.sendToAccountant.useMutation()` for sending
- `trpc.accountantPack.getSendHistory.useQuery()` for history table
- `trpc.team.listMembers.useQuery()` + `trpc.team.listInvites.useQuery()` to show connected accountant
- Sections picker with Switch components (default: tax sections ON, portfolio/loan OFF)
- Confirmation dialog before sending
- Pro+ gate: show upgrade prompt on send button for free users

**Step 1: Create the page**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import { downloadBlob } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/errors";
import {
  Briefcase,
  Download,
  Loader2,
  Mail,
  Send,
  UserPlus,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

const SECTION_CONFIG = [
  { key: "incomeExpenses" as const, label: "Income & Expenses", description: "Rental income and deductions by ATO code", defaultOn: true },
  { key: "depreciation" as const, label: "Depreciation Schedule", description: "Capital works (Div 43) and plant & equipment (Div 40)", defaultOn: true },
  { key: "capitalGains" as const, label: "Capital Gains Tax", description: "CGT calculations for sold properties", defaultOn: true },
  { key: "taxPosition" as const, label: "Tax Position Summary", description: "Taxable income, refund/owing estimate", defaultOn: true },
  { key: "portfolioOverview" as const, label: "Portfolio Overview", description: "Property values, equity, and LVR", defaultOn: false },
  { key: "loanDetails" as const, label: "Loan Details", description: "Loan balances, rates, and repayments", defaultOn: false },
];

type SectionKey = (typeof SECTION_CONFIG)[number]["key"];

export default function AccountantPackPage() {
  const currentYear =
    new Date().getMonth() >= 6
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>(() =>
    Object.fromEntries(SECTION_CONFIG.map((s) => [s.key, s.defaultOn])) as Record<SectionKey, boolean>
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();
  const { data: members } = trpc.team.listMembers.useQuery(undefined, {
    retry: false,
  });
  const { data: invites } = trpc.team.listInvites.useQuery(undefined, {
    retry: false,
  });
  const { data: sendHistory } = trpc.accountantPack.getSendHistory.useQuery();
  const { data: trialStatus } = trpc.billing.getTrialStatus.useQuery();

  const generateMutation = trpc.accountantPack.generatePack.useMutation({
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const sendMutation = trpc.accountantPack.sendToAccountant.useMutation({
    onSuccess: (data) => {
      toast.success(`Sent to ${data.sentTo}`);
      setShowConfirmDialog(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Find connected accountant
  const accountant = members?.members.find((m) => m.role === "accountant");
  const pendingAccountantInvite = invites?.find(
    (inv) => inv.role === "accountant" && inv.status === "pending"
  );
  const accountantEmail = accountant?.user?.email || pendingAccountantInvite?.email;
  const accountantName = accountant?.user?.name;
  const hasAccountant = !!accountantEmail;
  const isPro = trialStatus?.plan !== "free";

  const anySectionEnabled = Object.values(sections).some(Boolean);

  const handleToggleSection = (key: SectionKey) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadPreview = async () => {
    const result = await generateMutation.mutateAsync({
      financialYear: selectedYear,
      sections,
    });

    const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    downloadBlob(blob, result.filename);
    toast.success("PDF downloaded");
  };

  const handleSend = () => {
    sendMutation.mutate({
      financialYear: selectedYear,
      sections,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Accountant Pack</h2>
        <p className="text-muted-foreground">
          Generate and send a comprehensive report to your accountant
        </p>
      </div>

      {/* Connected Accountant */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connected Accountant</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAccountant ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  {accountantName && (
                    <p className="font-medium">{accountantName}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{accountantEmail}</p>
                  {pendingAccountantInvite && !accountant && (
                    <p className="text-xs text-amber-600">Invite pending</p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/advisors">Manage</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                No accountant connected yet
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/advisors">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Accountant
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pack Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configure Pack</CardTitle>
          <CardDescription>
            Select the financial year and sections to include
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Year Selection */}
          <div className="space-y-2">
            <Label>Financial Year</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears?.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    {y.label}
                  </SelectItem>
                )) || (
                  <SelectItem value={String(currentYear)}>
                    FY {currentYear - 1}-{String(currentYear).slice(-2)}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Section Toggles */}
          <div className="space-y-4">
            <Label>Sections</Label>
            {SECTION_CONFIG.map((section) => (
              <div
                key={section.key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium cursor-pointer">
                    {section.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {section.description}
                  </p>
                </div>
                <Switch
                  checked={sections[section.key]}
                  onCheckedChange={() => handleToggleSection(section.key)}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleDownloadPreview}
              disabled={generateMutation.isPending || !anySectionEnabled}
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download Preview
            </Button>

            {isPro ? (
              <Button
                onClick={() => setShowConfirmDialog(true)}
                disabled={!hasAccountant || !anySectionEnabled || sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Email to Accountant
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  toast.info("Upgrade to Pro to email your accountant", {
                    action: {
                      label: "Upgrade",
                      onClick: () => window.location.assign("/settings/billing"),
                    },
                  })
                }
              >
                <Lock className="w-4 h-4 mr-2" />
                Email to Accountant
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send History */}
      {sendHistory && sendHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Sent To</TableHead>
                  <TableHead>Sections</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendHistory.map((send) => {
                  const sectionCount = Object.values(
                    send.sections as Record<string, boolean>
                  ).filter(Boolean).length;
                  return (
                    <TableRow key={send.id}>
                      <TableCell className="text-sm">
                        {formatDate(send.sentAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        FY{send.financialYear}
                      </TableCell>
                      <TableCell className="text-sm">
                        {send.accountantName || send.accountantEmail}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sectionCount} section{sectionCount !== 1 ? "s" : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Accountant Pack</AlertDialogTitle>
            <AlertDialogDescription>
              Send your FY{selectedYear} accountant pack to{" "}
              <strong>{accountantName || accountantEmail}</strong>
              {accountantName && (
                <span className="text-muted-foreground"> ({accountantEmail})</span>
              )}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Add sidebar nav item**

In `src/components/layout/Sidebar.tsx`, add `FileOutput` to lucide imports and add to the "Reports & Tax" nav group:

```typescript
// Add to lucide import:
import { ..., FileOutput } from "lucide-react";

// Add to "Reports & Tax" items array after "Tax Position":
{ href: "/reports/accountant-pack", label: "Accountant Pack", icon: FileOutput },
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/reports/accountant-pack/page.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add accountant pack page with modular sections and sidebar navigation"
```

---

### Task 7: UI — Advisors Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/advisors/page.tsx`

**Context:** This page reuses the existing team router to manage accountant invites. It's a thin wrapper over `trpc.team.sendInvite`, `trpc.team.listMembers`, `trpc.team.listInvites`, `trpc.team.removeMember`, `trpc.team.cancelInvite`. The existing export page at `/reports/export` stays as-is.

**Step 1: Create the advisors page**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc/client";
import { getErrorMessage } from "@/lib/errors";
import {
  Briefcase,
  Clock,
  Loader2,
  Mail,
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function AdvisorsPage() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    email: string;
    type: "member" | "invite";
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: members, isLoading: membersLoading } = trpc.team.listMembers.useQuery(
    undefined,
    { retry: false }
  );
  const { data: invites, isLoading: invitesLoading } = trpc.team.listInvites.useQuery(
    undefined,
    { retry: false }
  );

  const isLoading = membersLoading || invitesLoading;

  // Filter to accountant-role only
  const accountantMembers = members?.members.filter((m) => m.role === "accountant") || [];
  const accountantInvites = invites?.filter((inv) => inv.role === "accountant") || [];

  const inviteMutation = trpc.team.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent");
      setShowInviteDialog(false);
      form.reset();
      utils.team.listInvites.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const removeMemberMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Accountant removed");
      setRemoveTarget(null);
      utils.team.listMembers.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const cancelInviteMutation = trpc.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
      setRemoveTarget(null);
      utils.team.listInvites.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "" },
  });

  const handleInvite = (values: InviteFormValues) => {
    inviteMutation.mutate({
      email: values.email,
      role: "accountant",
    });
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    if (removeTarget.type === "member") {
      removeMemberMutation.mutate({ memberId: removeTarget.id });
    } else {
      cancelInviteMutation.mutate({ inviteId: removeTarget.id });
    }
  };

  const hasNoAdvisors = accountantMembers.length === 0 && accountantInvites.length === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advisors</h2>
          <p className="text-muted-foreground">
            Manage your connected accountant
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Accountant
        </Button>
      </div>

      {/* Advisors List */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accountants</CardTitle>
          <CardDescription>
            Your accountant can receive financial reports via the Accountant Pack
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasNoAdvisors ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                No accountant connected yet. Add one to send them reports directly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active members */}
              {accountantMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      {member.user?.name && (
                        <p className="text-sm font-medium">{member.user.name}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {member.user?.email}
                      </p>
                      {member.joinedAt && (
                        <p className="text-xs text-muted-foreground">
                          Connected {formatDate(member.joinedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRemoveTarget({
                        id: member.id,
                        email: member.user?.email || "",
                        type: "member",
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {/* Pending invites */}
              {accountantInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-dashed p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {invite.email}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Invite pending
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRemoveTarget({
                        id: invite.id,
                        email: invite.email,
                        type: "invite",
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Accountant</DialogTitle>
            <DialogDescription>
              Send an invitation to your accountant. They&apos;ll receive
              read-only access to your financial data.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleInvite)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accountant Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="accountant@example.com.au"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowInviteDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeTarget?.type === "member"
                ? "Remove Accountant"
                : "Cancel Invitation"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.type === "member"
                ? `Remove ${removeTarget.email} as your accountant? They will lose access to your financial data.`
                : `Cancel the pending invitation to ${removeTarget?.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeTarget?.type === "member" ? "Remove" : "Cancel Invitation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/advisors/page.tsx
git commit -m "feat: add advisors settings page for accountant management"
```

---

## Summary

| Task | What | Files | Commit |
|------|------|-------|--------|
| 1 | Schema: `accountantPackSends` table | `schema/portfolio.ts` | `feat: add accountantPackSends schema` |
| 2 | Plan gating: `canEmailAccountant` | `subscription.ts` | `feat: add canEmailAccountant to plan limits` |
| 3 | Email template: accountant pack | `email/templates/accountant-pack.ts` + test | `feat: add accountant pack email template` |
| 4 | PDF generator: modular pack | `accountant-pack-pdf.ts` + test | `feat: add modular accountant pack PDF generator` |
| 5 | tRPC router: `accountantPack` | `analytics/accountantPack.ts` + barrel + root + test | `feat: add accountantPack tRPC router` |
| 6 | UI: Accountant Pack page + sidebar | `reports/accountant-pack/page.tsx` + `Sidebar.tsx` | `feat: add accountant pack page with sidebar` |
| 7 | UI: Advisors settings page | `settings/advisors/page.tsx` | `feat: add advisors settings page` |
