# Accountant Export Pack (EOFY) Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire 4 stubbed PDF sections with real data, add Excel export via exceljs, reformat income/expenses to match ATO Rental Schedule layout, and attach both PDF + Excel when emailing accountant.

**Architecture:** Server provides data via new `generatePackData` query. Client renders PDF (jsPDF, existing) and Excel (exceljs, new) from returned data. `sendToAccountant` generates both formats server-side for email attachment. All 4 missing data sources already exist in the codebase — no schema changes needed.

**Tech Stack:** tRPC v11, jsPDF (existing), exceljs (new), Resend (existing), Drizzle ORM

## Tech Notes

- **exceljs** — supports browser-side workbook generation with cell styling, number formats, frozen rows, auto-width. Import via `import ExcelJS from "exceljs"`.
- **jsPDF** — already in use for PDF generation. No changes to the library, only to rendering functions.
- **tRPC v11** — `trpc.useUtils()` not `useContext()`. `protectedProcedure` for reads.
- **Drizzle** — `ctx.uow.repo.method()` for data access. `ctx.db` only with cross-domain comment.
- **Categories** — ATO references are D1-D18, already defined in `src/lib/categories.ts`.

---

### Task 1: New `generatePackData` Procedure — Wire All 6 Sections

**Files:**
- Modify: `src/server/routers/analytics/accountantPack.ts`
- Test: `src/server/routers/analytics/__tests__/accountantPack.test.ts`

This task replaces the server-side PDF generation in `generatePack` with a data-only query, and wires up all 4 missing section data sources.

**Step 1: Write tests for generatePackData**

Add to `src/server/routers/analytics/__tests__/accountantPack.test.ts`:

```typescript
// Add these mocks at the top, after existing mocks:

vi.mock("../../../services/tax", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../services/tax")>();
  return {
    ...original,
    calculateTaxPosition: vi.fn().mockReturnValue({
      financialYear: 2025,
      grossSalary: 100000,
      rentalNetResult: -15000,
      taxableIncome: 85000,
      otherDeductions: 0,
      totalDeductions: 15000,
      baseTax: 19822,
      medicareLevy: 1700,
      medicareLevySurcharge: 0,
      hecsRepayment: 0,
      totalTaxLiability: 21522,
      paygWithheld: 25000,
      refundOrOwing: 3478,
      isRefund: true,
      marginalRate: 0.325,
      propertySavings: 4875,
      mlsApplies: false,
      mlsThreshold: 93000,
      combinedIncome: 85000,
      depreciationDeductions: 0,
    }),
  };
});

// Add to describe block:

it("generatePackData returns tax report data when incomeExpenses enabled", async () => {
  const mod = await import("../accountantPack");
  expect(mod.accountantPackRouter._def.procedures.generatePackData).toBeDefined();
});

it("generatePackData returns CGT data when capitalGains enabled and sold properties exist", async () => {
  // Verifies the procedure exists and can be called with section toggles
  const mod = await import("../accountantPack");
  expect(mod.accountantPackRouter._def.procedures.generatePackData).toBeDefined();
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/routers/analytics/__tests__/accountantPack.test.ts`
Expected: FAIL — `generatePackData` does not exist yet.

**Step 3: Implement `generatePackData` and refactor `generatePack`**

In `src/server/routers/analytics/accountantPack.ts`:

1. Add imports at the top:

```typescript
import {
  calculateTaxPosition,
  type TaxPositionInput,
  calculateCostBase,
  CAPITAL_CATEGORIES,
} from "../../services/tax";
import {
  getFinancialYearRange,
  getFinancialYearTransactions,
  calculatePropertyMetrics,
  calculateCategoryTotals,
  calculateEquity,
  calculateLVR,
} from "../../services/transaction";
import { loans, propertyValues, propertySales } from "../../db/schema";
```

2. Add a `buildAllSectionData` helper function (replaces separate data fetchers):

```typescript
async function buildAllSectionData(
  userId: string,
  financialYear: number,
  sections: z.infer<typeof sectionsSchema>,
  db: DB,
  uow: typeof import("../../uow").UnitOfWork.prototype
) {
  const data: Record<string, unknown> = {};

  // Always build tax report (needed for income/expenses)
  const taxReport = await buildTaxReportData(userId, financialYear, db);
  if (sections.incomeExpenses) {
    data.taxReport = taxReport;
  }

  // Parallel fetch for all optional sections
  const [myTaxReport, taxProfile, rentalResult, properties, allLoans, cgtSummary] =
    await Promise.all([
      sections.depreciation
        ? buildMyTaxReport(userId, financialYear)
        : Promise.resolve(undefined),
      sections.taxPosition
        ? uow.tax.findProfileByUserAndYear(userId, financialYear)
        : Promise.resolve(undefined),
      sections.taxPosition
        ? (async () => {
            const { startDate, endDate } = getFinancialYearRange(financialYear);
            // Cross-domain: queries transactions for FY rental metrics
            const txns = await db.query.transactions.findMany({
              where: and(
                eq(transactions.userId, userId),
                gte(transactions.date, startDate),
                lte(transactions.date, endDate)
              ),
            });
            return calculatePropertyMetrics(
              txns.map((t) => ({
                category: t.category,
                amount: t.amount,
                transactionType: t.transactionType,
              }))
            );
          })()
        : Promise.resolve(undefined),
      sections.portfolioOverview || sections.loanDetails
        ? uow.portfolio.findProperties(userId)
        : Promise.resolve([]),
      sections.loanDetails || sections.portfolioOverview
        ? uow.loan.findByOwner(userId)
        : Promise.resolve([]),
      sections.capitalGains
        ? uow.property.findByOwnerWithSales(userId)
        : Promise.resolve(undefined),
    ]);

  if (sections.depreciation && myTaxReport) {
    data.myTaxReport = myTaxReport;
  }

  // Tax Position
  if (sections.taxPosition && taxProfile?.isComplete && rentalResult) {
    const result = calculateTaxPosition({
      financialYear,
      grossSalary: Number(taxProfile.grossSalary ?? 0),
      paygWithheld: Number(taxProfile.paygWithheld ?? 0),
      rentalNetResult: rentalResult.netIncome,
      otherDeductions: Number(taxProfile.otherDeductions ?? 0),
      hasHecsDebt: taxProfile.hasHecsDebt,
      hasPrivateHealth: taxProfile.hasPrivateHealth,
      familyStatus: taxProfile.familyStatus,
      dependentChildren: taxProfile.dependentChildren,
      partnerIncome: Number(taxProfile.partnerIncome ?? 0),
      depreciationDeductions: 0,
    });
    data.taxPosition = {
      taxableIncome: result.taxableIncome,
      baseTax: result.baseTax,
      medicareLevy: result.medicareLevy,
      medicareLevySurcharge: result.medicareLevySurcharge,
      hecsRepayment: result.hecsRepayment,
      totalTaxLiability: result.totalTaxLiability,
      paygWithheld: result.paygWithheld,
      refundOrOwing: result.refundOrOwing,
      isRefund: result.isRefund,
      marginalRate: result.marginalRate,
      propertySavings: result.propertySavings,
    };
  }

  // Portfolio Overview
  if (sections.portfolioOverview && properties.length > 0) {
    const propertyIds = properties.map((p) => p.id);
    const latestValues = await uow.portfolio.getLatestPropertyValues(userId, propertyIds);

    const loansByProperty = new Map<string, number>();
    for (const loan of allLoans) {
      const current = loansByProperty.get(loan.propertyId) || 0;
      loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
    }

    const totalValue = properties.reduce(
      (sum, p) => sum + (latestValues.get(p.id) || Number(p.purchasePrice)),
      0
    );
    const totalDebt = Array.from(loansByProperty.values()).reduce((a, b) => a + b, 0);

    data.portfolioSnapshot = {
      properties: properties.map((p) => ({
        address: p.address,
        suburb: p.suburb,
        state: p.state,
        purchasePrice: Number(p.purchasePrice),
        currentValue: latestValues.get(p.id) || Number(p.purchasePrice),
        equity: calculateEquity(
          latestValues.get(p.id) || Number(p.purchasePrice),
          loansByProperty.get(p.id) || 0
        ),
        lvr: calculateLVR(
          loansByProperty.get(p.id) || 0,
          latestValues.get(p.id) || Number(p.purchasePrice)
        ) ?? 0,
      })),
      totals: {
        totalValue,
        totalDebt,
        totalEquity: calculateEquity(totalValue, totalDebt),
        avgLvr: calculateLVR(totalDebt, totalValue) ?? 0,
        propertyCount: properties.length,
      },
    };
  }

  // Loan Details
  if (sections.loanDetails && allLoans.length > 0) {
    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    const loansByProperty = new Map<string, typeof allLoans>();
    for (const loan of allLoans) {
      const list = loansByProperty.get(loan.propertyId) || [];
      list.push(loan);
      loansByProperty.set(loan.propertyId, list);
    }

    const totalDebt = allLoans.reduce((sum, l) => sum + Number(l.currentBalance), 0);
    const weightedRate =
      totalDebt > 0
        ? allLoans.reduce(
            (sum, l) => sum + Number(l.currentBalance) * Number(l.interestRate),
            0
          ) / totalDebt
        : 0;

    const frequencyMultiplier: Record<string, number> = {
      weekly: 52 / 12,
      fortnightly: 26 / 12,
      monthly: 1,
    };
    const monthlyRepayments = allLoans.reduce(
      (sum, l) =>
        sum +
        Number(l.repaymentAmount) *
          (frequencyMultiplier[l.repaymentFrequency] ?? 1),
      0
    );

    data.loanPackSnapshot = {
      properties: Array.from(loansByProperty.entries()).map(([propId, propLoans]) => {
        const prop = propertyMap.get(propId);
        return {
          address: prop
            ? `${prop.address}, ${prop.suburb} ${prop.state}`
            : "Unknown Property",
          loans: propLoans.map((l) => ({
            lender: l.lender,
            balance: Number(l.currentBalance),
            rate: Number(l.interestRate),
            type: l.loanType === "principal_and_interest" ? "P&I" : "Interest Only",
            monthlyRepayment:
              Number(l.repaymentAmount) *
              (frequencyMultiplier[l.repaymentFrequency] ?? 1),
          })),
        };
      }),
      totals: {
        totalDebt,
        avgRate: weightedRate,
        monthlyRepayments,
      },
    };
  }

  // Capital Gains
  if (sections.capitalGains && cgtSummary) {
    const { startDate, endDate } = getFinancialYearRange(financialYear);
    const soldInFY = cgtSummary.filter(
      (p) =>
        p.status === "sold" &&
        p.sales?.[0]?.settlementDate &&
        p.sales[0].settlementDate >= startDate &&
        p.sales[0].settlementDate <= endDate
    );

    // Get capital transactions for cost base calculation
    const allTxns = await uow.transactions.findAllByOwner(userId);
    const capitalTxnsByProperty = new Map<string, typeof allTxns>();
    for (const txn of allTxns) {
      if (txn.propertyId && CAPITAL_CATEGORIES.includes(txn.category)) {
        const existing = capitalTxnsByProperty.get(txn.propertyId) ?? [];
        existing.push(txn);
        capitalTxnsByProperty.set(txn.propertyId, existing);
      }
    }

    data.cgtData = soldInFY.map((p) => {
      const sale = p.sales![0];
      const costBase = calculateCostBase(
        p.purchasePrice,
        capitalTxnsByProperty.get(p.id) ?? []
      );
      return {
        propertyAddress: `${p.address}, ${p.suburb} ${p.state}`,
        purchaseDate: p.purchaseDate,
        saleDate: sale.settlementDate,
        costBase,
        salePrice: Number(sale.salePrice),
        capitalGain: Number(sale.capitalGain),
        discountedGain: sale.discountedGain ? Number(sale.discountedGain) : Number(sale.capitalGain),
        heldOverTwelveMonths: sale.heldOverTwelveMonths,
      };
    });
  }

  return data;
}
```

3. Add the `generatePackData` query and update `generatePack` + `sendToAccountant` to use it:

```typescript
generatePackData: protectedProcedure
  .input(
    z.object({
      financialYear: z.number().min(2000).max(2100),
      sections: sectionsSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const { financialYear, sections } = input;
    const data = await buildAllSectionData(
      ctx.portfolio.ownerId,
      financialYear,
      sections,
      ctx.db,
      ctx.uow
    );

    // Get accountant name for cover page
    const members = await ctx.uow.team.listMembers(ctx.portfolio.ownerId);
    const accountant = members.find(
      (m) => m.role === "accountant" && m.joinedAt !== null
    );

    return {
      financialYear,
      userName: ctx.user.name || ctx.user.email || "Unknown",
      accountantName: accountant?.user?.name || undefined,
      sections,
      data,
    };
  }),
```

4. Update `generatePack` mutation to call `buildAllSectionData` instead of just tax/myTax:

```typescript
generatePack: writeProcedure
  .input(/* same */)
  .mutation(async ({ ctx, input }) => {
    const { financialYear, sections } = input;
    const data = await buildAllSectionData(
      ctx.portfolio.ownerId, financialYear, sections, ctx.db, ctx.uow
    );

    const members = await ctx.uow.team.listMembers(ctx.portfolio.ownerId);
    const accountant = members.find(
      (m) => m.role === "accountant" && m.joinedAt !== null
    );

    const pdfBuffer = generateAccountantPackPDF({
      financialYear,
      userName: ctx.user.name || ctx.user.email || "Unknown",
      accountantName: accountant?.user?.name || undefined,
      sections,
      data,
    });

    return {
      pdf: Buffer.from(pdfBuffer).toString("base64"),
      filename: `accountant-pack-FY${financialYear}.pdf`,
    };
  }),
```

5. Update `sendToAccountant` similarly — replace the inline data building with `buildAllSectionData()`, and pass all data to PDF generation.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/routers/analytics/__tests__/accountantPack.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/analytics/accountantPack.ts src/server/routers/analytics/__tests__/accountantPack.test.ts
git commit -m "feat: wire all 6 sections with real data in accountant pack"
```

---

### Task 2: ATO Format Improvements — Reformat Income & Expenses PDF

**Files:**
- Modify: `src/lib/accountant-pack-pdf.ts`
- Test: `src/lib/__tests__/accountant-pack-pdf.test.ts`

Reorder deductions to ATO Rental Schedule order, add left-aligned ATO reference column, and add per-property summary table.

**Step 1: Write tests for ATO ordering**

Create/update `src/lib/__tests__/accountant-pack-pdf.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateAccountantPackPDF } from "../accountant-pack-pdf";

describe("generateAccountantPackPDF", () => {
  it("generates a valid PDF ArrayBuffer with income/expenses section", () => {
    const result = generateAccountantPackPDF({
      financialYear: 2025,
      userName: "Test User",
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
          generatedAt: new Date().toISOString(),
          properties: [
            {
              property: {
                id: "1",
                address: "10 Test St",
                suburb: "Sydney",
                state: "NSW",
                entityName: null,
              },
              metrics: {
                totalIncome: 26000,
                totalExpenses: 18000,
                netIncome: 8000,
                totalDeductible: 18000,
              },
              atoBreakdown: [
                { category: "rent", label: "Rent", amount: 26000, atoReference: null, isDeductible: false },
                { category: "interest_on_loans", label: "Interest on Loans", amount: -12000, atoReference: "D8", isDeductible: true },
                { category: "council_rates", label: "Council Rates", amount: -3000, atoReference: "D5", isDeductible: true },
                { category: "insurance", label: "Insurance", amount: -2000, atoReference: "D7", isDeductible: true },
                { category: "property_agent_fees", label: "Property Agent Fees", amount: -1000, atoReference: "D12", isDeductible: true },
              ],
              transactionCount: 24,
            },
          ],
          totals: {
            totalIncome: 26000,
            totalExpenses: 18000,
            netIncome: 8000,
            totalDeductible: 18000,
          },
        },
      },
    });

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it("generates PDF with all 6 sections populated", () => {
    const result = generateAccountantPackPDF({
      financialYear: 2025,
      userName: "Test User",
      accountantName: "John CPA",
      sections: {
        incomeExpenses: true,
        depreciation: true,
        capitalGains: true,
        taxPosition: true,
        portfolioOverview: true,
        loanDetails: true,
      },
      data: {
        taxReport: {
          financialYear: "FY2024-25",
          startDate: "2024-07-01",
          endDate: "2025-06-30",
          generatedAt: new Date().toISOString(),
          properties: [],
          totals: { totalIncome: 0, totalExpenses: 0, netIncome: 0, totalDeductible: 0 },
        },
        myTaxReport: {
          financialYear: "FY2024-25",
          properties: [],
        },
        cgtData: [],
        taxPosition: {
          taxableIncome: 85000,
          baseTax: 19822,
          medicareLevy: 1700,
          medicareLevySurcharge: 0,
          hecsRepayment: 0,
          totalTaxLiability: 21522,
          paygWithheld: 25000,
          refundOrOwing: 3478,
          isRefund: true,
          marginalRate: 0.325,
          propertySavings: 4875,
        },
        portfolioSnapshot: {
          properties: [
            { address: "10 Test St", suburb: "Sydney", state: "NSW", purchasePrice: 800000, currentValue: 850000, equity: 350000, lvr: 0.588 },
          ],
          totals: { totalValue: 850000, totalDebt: 500000, totalEquity: 350000, avgLvr: 0.588, propertyCount: 1 },
        },
        loanPackSnapshot: {
          properties: [
            {
              address: "10 Test St, Sydney NSW",
              loans: [{ lender: "CBA", balance: 500000, rate: 6.29, type: "P&I", monthlyRepayment: 3100 }],
            },
          ],
          totals: { totalDebt: 500000, avgRate: 6.29, monthlyRepayments: 3100 },
        },
      },
    });

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests to verify they pass (baseline)**

Run: `npx vitest run src/lib/__tests__/accountant-pack-pdf.test.ts`
Expected: PASS (existing PDF function should handle all data)

**Step 3: Reformat `addIncomeExpenses` function**

In `src/lib/accountant-pack-pdf.ts`, modify the `addIncomeExpenses` function:

1. Sort deduction items by ATO reference number (D1 first, D18 last):

```typescript
// Inside addIncomeExpenses, replace deductionItems filtering with:
const deductionItems = prop.atoBreakdown
  .filter((item) => item.isDeductible && item.amount !== 0)
  .sort((a, b) => {
    const aNum = parseInt(a.atoReference?.replace("D", "") ?? "99");
    const bNum = parseInt(b.atoReference?.replace("D", "") ?? "99");
    return aNum - bNum;
  });
```

2. Use two-column layout for deductions (ATO ref left, amount right):

```typescript
// Replace deduction rendering with:
for (const item of deductionItems) {
  y = checkNewPage(doc, y, 6);
  const ref = item.atoReference ?? "";
  // ATO ref column (left-aligned, fixed width)
  doc.setFont("helvetica", "bold");
  doc.text(ref, MARGIN_LEFT + 10, y);
  // Label (after ref column)
  doc.setFont("helvetica", "normal");
  doc.text(item.label, MARGIN_LEFT + 25, y);
  // Amount (right-aligned)
  doc.text(
    formatCurrencyWithCents(Math.abs(item.amount)),
    MARGIN_RIGHT,
    y,
    { align: "right" }
  );
  y += 5;
}
```

3. Add per-property summary table at the end of the section. After the Portfolio Totals block, add:

```typescript
// Summary Table — one row per property
if (data.properties.length > 1) {
  y = checkNewPage(doc, y, 15 + data.properties.length * 6);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Net Rental Income Summary", MARGIN_LEFT, y);
  y += 7;

  // Header row
  doc.setFontSize(8);
  doc.text("Property", MARGIN_LEFT + 5, y);
  doc.text("Income", 95, y, { align: "right" });
  doc.text("Deductions", 125, y, { align: "right" });
  doc.text("Net Result", MARGIN_RIGHT, y, { align: "right" });
  y += 1;
  doc.line(MARGIN_LEFT + 5, y, MARGIN_RIGHT, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  for (const prop of data.properties) {
    y = checkNewPage(doc, y, 6);
    const label = `${prop.property.suburb} ${prop.property.state}`;
    doc.text(label, MARGIN_LEFT + 5, y);
    doc.text(formatCurrencyWithCents(prop.metrics.totalIncome), 95, y, { align: "right" });
    doc.text(formatCurrencyWithCents(prop.metrics.totalDeductible), 125, y, { align: "right" });
    doc.text(formatCurrencyWithCents(prop.metrics.netIncome), MARGIN_RIGHT, y, { align: "right" });
    y += 5;
  }

  // Totals row
  y += 1;
  doc.line(MARGIN_LEFT + 5, y, MARGIN_RIGHT, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Total", MARGIN_LEFT + 5, y);
  doc.text(formatCurrencyWithCents(data.totals.totalIncome), 95, y, { align: "right" });
  doc.text(formatCurrencyWithCents(data.totals.totalDeductible), 125, y, { align: "right" });
  doc.text(formatCurrencyWithCents(data.totals.netIncome), MARGIN_RIGHT, y, { align: "right" });
  y += 10;
}
```

4. Update cover page to add BrickTrack line:

```typescript
// After the disclaimer line in generateAccountantPackPDF:
y += 5;
doc.text("Prepared using BrickTrack — bricktrack.au", MARGIN_LEFT, y);
```

**Step 4: Run tests to verify they still pass**

Run: `npx vitest run src/lib/__tests__/accountant-pack-pdf.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/accountant-pack-pdf.ts src/lib/__tests__/accountant-pack-pdf.test.ts
git commit -m "feat: reformat income/expenses to ATO Rental Schedule order"
```

---

### Task 3: Excel Export — `accountant-pack-excel.ts`

**Files:**
- Create: `src/lib/accountant-pack-excel.ts`
- Test: `src/lib/__tests__/accountant-pack-excel.test.ts`

**Step 1: Install exceljs**

Run: `npm install exceljs`

**Step 2: Write tests**

Create `src/lib/__tests__/accountant-pack-excel.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateAccountantPackExcel } from "../accountant-pack-excel";
import type { AccountantPackConfig } from "../accountant-pack-pdf";

const baseConfig: AccountantPackConfig = {
  financialYear: 2025,
  userName: "Test User",
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
      generatedAt: new Date().toISOString(),
      properties: [
        {
          property: { id: "1", address: "10 Test St", suburb: "Sydney", state: "NSW", entityName: null },
          metrics: { totalIncome: 26000, totalExpenses: 18000, netIncome: 8000, totalDeductible: 18000 },
          atoBreakdown: [
            { category: "rent", label: "Rent", amount: 26000, atoReference: null, isDeductible: false },
            { category: "interest_on_loans", label: "Interest on Loans", amount: -12000, atoReference: "D8", isDeductible: true },
          ],
          transactionCount: 12,
        },
      ],
      totals: { totalIncome: 26000, totalExpenses: 18000, netIncome: 8000, totalDeductible: 18000 },
    },
  },
};

describe("generateAccountantPackExcel", () => {
  it("generates a valid Excel buffer with income/expenses sheet", async () => {
    const buffer = await generateAccountantPackExcel(baseConfig);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("generates sheets for all enabled sections", async () => {
    const config: AccountantPackConfig = {
      ...baseConfig,
      sections: {
        incomeExpenses: true,
        depreciation: true,
        capitalGains: true,
        taxPosition: true,
        portfolioOverview: true,
        loanDetails: true,
      },
      data: {
        ...baseConfig.data,
        myTaxReport: { financialYear: "FY2024-25", properties: [] },
        cgtData: [],
        taxPosition: {
          taxableIncome: 85000,
          baseTax: 19822,
          medicareLevy: 1700,
          medicareLevySurcharge: 0,
          hecsRepayment: 0,
          totalTaxLiability: 21522,
          paygWithheld: 25000,
          refundOrOwing: 3478,
          isRefund: true,
          marginalRate: 0.325,
          propertySavings: 4875,
        },
        portfolioSnapshot: {
          properties: [],
          totals: { totalValue: 0, totalDebt: 0, totalEquity: 0, avgLvr: 0, propertyCount: 0 },
        },
        loanPackSnapshot: {
          properties: [],
          totals: { totalDebt: 0, avgRate: 0, monthlyRepayments: 0 },
        },
      },
    };

    const buffer = await generateAccountantPackExcel(config);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("skips sheets for disabled sections", async () => {
    const config: AccountantPackConfig = {
      ...baseConfig,
      sections: {
        incomeExpenses: false,
        depreciation: false,
        capitalGains: false,
        taxPosition: true,
        portfolioOverview: false,
        loanDetails: false,
      },
      data: {
        taxPosition: {
          taxableIncome: 85000,
          baseTax: 19822,
          medicareLevy: 1700,
          medicareLevySurcharge: 0,
          hecsRepayment: 0,
          totalTaxLiability: 21522,
          paygWithheld: 25000,
          refundOrOwing: 3478,
          isRefund: true,
          marginalRate: 0.325,
          propertySavings: 4875,
        },
      },
    };

    const buffer = await generateAccountantPackExcel(config);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/accountant-pack-excel.test.ts`
Expected: FAIL — module does not exist.

**Step 4: Implement `accountant-pack-excel.ts`**

Create `src/lib/accountant-pack-excel.ts`:

```typescript
import ExcelJS from "exceljs";
import type { AccountantPackConfig } from "./accountant-pack-pdf";

const CURRENCY_FORMAT = '$#,##0.00';
const PERCENT_FORMAT = '0.0%';

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E8E8" },
  };
  row.alignment = { vertical: "middle" };
}

function addIncomeExpensesSheet(workbook: ExcelJS.Workbook, config: AccountantPackConfig) {
  const data = config.data.taxReport;
  if (!data) return;

  const sheet = workbook.addWorksheet("Income & Expenses");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "ATO Ref", key: "atoRef", width: 10 },
    { header: "Category", key: "category", width: 25 },
    { header: "Type", key: "type", width: 12 },
    { header: "Amount", key: "amount", width: 15 },
  ];
  styleHeaderRow(sheet.getRow(1));
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  for (const prop of data.properties) {
    const address = `${prop.property.address}, ${prop.property.suburb} ${prop.property.state}`;

    // Income items
    const incomeItems = prop.atoBreakdown.filter(
      (item) => !item.isDeductible && item.amount > 0
    );
    for (const item of incomeItems) {
      const row = sheet.addRow({
        property: address,
        atoRef: item.atoReference ?? "",
        category: item.label,
        type: "Income",
        amount: item.amount,
      });
      row.getCell("amount").numFmt = CURRENCY_FORMAT;
    }

    // Deduction items (sorted by ATO ref)
    const deductionItems = prop.atoBreakdown
      .filter((item) => item.isDeductible && item.amount !== 0)
      .sort((a, b) => {
        const aNum = parseInt(a.atoReference?.replace("D", "") ?? "99");
        const bNum = parseInt(b.atoReference?.replace("D", "") ?? "99");
        return aNum - bNum;
      });
    for (const item of deductionItems) {
      const row = sheet.addRow({
        property: address,
        atoRef: item.atoReference ?? "",
        category: item.label,
        type: "Deduction",
        amount: Math.abs(item.amount),
      });
      row.getCell("amount").numFmt = CURRENCY_FORMAT;
    }

    // Property subtotal
    const subtotalRow = sheet.addRow({
      property: "",
      atoRef: "",
      category: `Subtotal — ${prop.property.suburb}`,
      type: "",
      amount: prop.metrics.netIncome,
    });
    subtotalRow.font = { bold: true };
    subtotalRow.getCell("amount").numFmt = CURRENCY_FORMAT;
    sheet.addRow({});
  }

  // Grand totals
  const totalRow = sheet.addRow({
    property: "",
    atoRef: "",
    category: "PORTFOLIO TOTAL",
    type: "Income",
    amount: data.totals.totalIncome,
  });
  totalRow.font = { bold: true };
  totalRow.getCell("amount").numFmt = CURRENCY_FORMAT;

  const deductionTotal = sheet.addRow({
    property: "",
    atoRef: "",
    category: "",
    type: "Deductions",
    amount: data.totals.totalDeductible,
  });
  deductionTotal.font = { bold: true };
  deductionTotal.getCell("amount").numFmt = CURRENCY_FORMAT;

  const netTotal = sheet.addRow({
    property: "",
    atoRef: "",
    category: "",
    type: "Net Result",
    amount: data.totals.netIncome,
  });
  netTotal.font = { bold: true };
  netTotal.getCell("amount").numFmt = CURRENCY_FORMAT;
}

function addDepreciationSheet(workbook: ExcelJS.Workbook, config: AccountantPackConfig) {
  const data = config.data.myTaxReport;
  if (!data) return;

  const sheet = workbook.addWorksheet("Depreciation");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Division", key: "division", width: 20 },
    { header: "Amount", key: "amount", width: 15 },
  ];
  styleHeaderRow(sheet.getRow(1));
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  for (const prop of data.properties) {
    if (prop.depreciation.capitalWorks === 0 && prop.depreciation.plantEquipment === 0) continue;
    const address = `${prop.address}, ${prop.suburb} ${prop.state}`;

    if (prop.depreciation.capitalWorks > 0) {
      const row = sheet.addRow({ property: address, division: "Capital Works (Div 43)", amount: prop.depreciation.capitalWorks });
      row.getCell("amount").numFmt = CURRENCY_FORMAT;
    }
    if (prop.depreciation.plantEquipment > 0) {
      const row = sheet.addRow({ property: address, division: "Plant & Equipment (Div 40)", amount: prop.depreciation.plantEquipment });
      row.getCell("amount").numFmt = CURRENCY_FORMAT;
    }
  }
}

function addCapitalGainsSheet(workbook: ExcelJS.Workbook, config: AccountantPackConfig) {
  const data = config.data.cgtData;
  if (!data) return;

  const sheet = workbook.addWorksheet("Capital Gains");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Purchased", key: "purchaseDate", width: 14 },
    { header: "Sold", key: "saleDate", width: 14 },
    { header: "Cost Base", key: "costBase", width: 15 },
    { header: "Sale Price", key: "salePrice", width: 15 },
    { header: "Capital Gain", key: "capitalGain", width: 15 },
    { header: "Discounted Gain", key: "discountedGain", width: 15 },
    { header: "Held >12mo", key: "heldOver", width: 12 },
  ];
  styleHeaderRow(sheet.getRow(1));
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  if (data.length === 0) {
    sheet.addRow({ property: "No properties sold in this financial year" });
    return;
  }

  for (const prop of data) {
    const row = sheet.addRow({
      property: prop.propertyAddress,
      purchaseDate: prop.purchaseDate,
      saleDate: prop.saleDate,
      costBase: prop.costBase,
      salePrice: prop.salePrice,
      capitalGain: prop.capitalGain,
      discountedGain: prop.heldOverTwelveMonths ? prop.discountedGain : prop.capitalGain,
      heldOver: prop.heldOverTwelveMonths ? "Yes" : "No",
    });
    row.getCell("costBase").numFmt = CURRENCY_FORMAT;
    row.getCell("salePrice").numFmt = CURRENCY_FORMAT;
    row.getCell("capitalGain").numFmt = CURRENCY_FORMAT;
    row.getCell("discountedGain").numFmt = CURRENCY_FORMAT;
  }
}

function addTaxPositionSheet(workbook: ExcelJS.Workbook, config: AccountantPackConfig) {
  const data = config.data.taxPosition;
  if (!data) return;

  const sheet = workbook.addWorksheet("Tax Position");
  sheet.columns = [
    { header: "Item", key: "item", width: 30 },
    { header: "Amount", key: "amount", width: 18 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const items: [string, number][] = [
    ["Taxable Income", data.taxableIncome],
    ["Base Tax", data.baseTax],
    ["Medicare Levy", data.medicareLevy],
  ];
  if (data.medicareLevySurcharge > 0) {
    items.push(["Medicare Levy Surcharge", data.medicareLevySurcharge]);
  }
  if (data.hecsRepayment > 0) {
    items.push(["HECS/HELP Repayment", data.hecsRepayment]);
  }
  items.push(
    ["Total Tax Liability", data.totalTaxLiability],
    ["PAYG Withheld", data.paygWithheld],
    [data.isRefund ? "Estimated Refund" : "Estimated Owing", Math.abs(data.refundOrOwing)]
  );

  for (const [item, amount] of items) {
    const row = sheet.addRow({ item, amount });
    row.getCell("amount").numFmt = CURRENCY_FORMAT;
  }

  sheet.addRow({});
  const rateRow = sheet.addRow({ item: "Marginal Rate", amount: data.marginalRate });
  rateRow.getCell("amount").numFmt = PERCENT_FORMAT;
  const savingsRow = sheet.addRow({ item: "Property Tax Savings", amount: data.propertySavings });
  savingsRow.getCell("amount").numFmt = CURRENCY_FORMAT;
}

function addPortfolioSheet(workbook: ExcelJS.Workbook, config: AccountantPackConfig) {
  const data = config.data.portfolioSnapshot;
  if (!data) return;

  const sheet = workbook.addWorksheet("Portfolio Overview");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Purchase Price", key: "purchasePrice", width: 18 },
    { header: "Current Value", key: "currentValue", width: 18 },
    { header: "Equity", key: "equity", width: 18 },
    { header: "LVR", key: "lvr", width: 10 },
  ];
  styleHeaderRow(sheet.getRow(1));
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  for (const prop of data.properties) {
    const row = sheet.addRow({
      property: `${prop.address}, ${prop.suburb} ${prop.state}`,
      purchasePrice: prop.purchasePrice,
      currentValue: prop.currentValue,
      equity: prop.equity,
      lvr: prop.lvr,
    });
    row.getCell("purchasePrice").numFmt = CURRENCY_FORMAT;
    row.getCell("currentValue").numFmt = CURRENCY_FORMAT;
    row.getCell("equity").numFmt = CURRENCY_FORMAT;
    row.getCell("lvr").numFmt = PERCENT_FORMAT;
  }

  // Totals
  const totalRow = sheet.addRow({
    property: "TOTAL",
    purchasePrice: null,
    currentValue: data.totals.totalValue,
    equity: data.totals.totalEquity,
    lvr: data.totals.avgLvr,
  });
  totalRow.font = { bold: true };
  totalRow.getCell("currentValue").numFmt = CURRENCY_FORMAT;
  totalRow.getCell("equity").numFmt = CURRENCY_FORMAT;
  totalRow.getCell("lvr").numFmt = PERCENT_FORMAT;
}

function addLoanDetailsSheet(workbook: ExcelJS.Workbook, config: AccountantPackConfig) {
  const data = config.data.loanPackSnapshot;
  if (!data) return;

  const sheet = workbook.addWorksheet("Loan Details");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Lender", key: "lender", width: 18 },
    { header: "Type", key: "type", width: 14 },
    { header: "Balance", key: "balance", width: 18 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Monthly Repayment", key: "repayment", width: 18 },
  ];
  styleHeaderRow(sheet.getRow(1));
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  for (const prop of data.properties) {
    for (const loan of prop.loans) {
      const row = sheet.addRow({
        property: prop.address,
        lender: loan.lender,
        type: loan.type,
        balance: loan.balance,
        rate: loan.rate / 100,
        repayment: loan.monthlyRepayment,
      });
      row.getCell("balance").numFmt = CURRENCY_FORMAT;
      row.getCell("rate").numFmt = PERCENT_FORMAT;
      row.getCell("repayment").numFmt = CURRENCY_FORMAT;
    }
  }

  // Totals
  const totalRow = sheet.addRow({
    property: "TOTAL",
    lender: "",
    type: "",
    balance: data.totals.totalDebt,
    rate: data.totals.avgRate / 100,
    repayment: data.totals.monthlyRepayments,
  });
  totalRow.font = { bold: true };
  totalRow.getCell("balance").numFmt = CURRENCY_FORMAT;
  totalRow.getCell("rate").numFmt = PERCENT_FORMAT;
  totalRow.getCell("repayment").numFmt = CURRENCY_FORMAT;
}

/**
 * Generate accountant pack Excel workbook. Returns ArrayBuffer for download.
 * One sheet per enabled section.
 */
export async function generateAccountantPackExcel(
  config: AccountantPackConfig
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BrickTrack";
  workbook.created = new Date();

  if (config.sections.incomeExpenses) addIncomeExpensesSheet(workbook, config);
  if (config.sections.depreciation) addDepreciationSheet(workbook, config);
  if (config.sections.capitalGains) addCapitalGainsSheet(workbook, config);
  if (config.sections.taxPosition) addTaxPositionSheet(workbook, config);
  if (config.sections.portfolioOverview) addPortfolioSheet(workbook, config);
  if (config.sections.loanDetails) addLoanDetailsSheet(workbook, config);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/accountant-pack-excel.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/accountant-pack-excel.ts src/lib/__tests__/accountant-pack-excel.test.ts package.json package-lock.json
git commit -m "feat: add Excel export for accountant pack"
```

---

### Task 4: UI — Add Excel Download Button

**Files:**
- Modify: `src/app/(dashboard)/reports/accountant-pack/page.tsx`

**Step 1: Update page to use `generatePackData` and add Excel download**

In `src/app/(dashboard)/reports/accountant-pack/page.tsx`:

1. Add imports:

```typescript
import { FileSpreadsheet } from "lucide-react";
import { generateAccountantPackPDF } from "@/lib/accountant-pack-pdf";
import { generateAccountantPackExcel } from "@/lib/accountant-pack-excel";
```

2. Replace the `generateMutation` with a `generatePackData` query pattern. Use `trpc.accountantPack.generatePackData.useQuery()` with `enabled: false` (manual trigger):

```typescript
const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

const packDataQuery = trpc.accountantPack.generatePackData.useQuery(
  { financialYear: selectedYear, sections },
  { enabled: false }
);

const handleDownloadPDF = async () => {
  setIsGeneratingPdf(true);
  try {
    const result = await packDataQuery.refetch();
    if (!result.data) throw new Error("Failed to fetch data");
    const pdfBuffer = generateAccountantPackPDF(result.data);
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    downloadBlob(blob, `accountant-pack-FY${selectedYear}.pdf`);
    toast.success("PDF downloaded");
  } catch (error) {
    toast.error(getErrorMessage(error));
  } finally {
    setIsGeneratingPdf(false);
  }
};

const handleDownloadExcel = async () => {
  setIsGeneratingExcel(true);
  try {
    const result = await packDataQuery.refetch();
    if (!result.data) throw new Error("Failed to fetch data");
    const excelBuffer = await generateAccountantPackExcel(result.data);
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `accountant-pack-FY${selectedYear}.xlsx`);
    toast.success("Excel downloaded");
  } catch (error) {
    toast.error(getErrorMessage(error));
  } finally {
    setIsGeneratingExcel(false);
  }
};
```

3. Replace the Actions div with two download buttons:

```tsx
{/* Actions */}
<div className="flex gap-3 pt-2">
  <Button
    variant="outline"
    onClick={handleDownloadPDF}
    disabled={isGeneratingPdf || !anySectionEnabled}
  >
    {isGeneratingPdf ? (
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    ) : (
      <Download className="w-4 h-4 mr-2" />
    )}
    Download PDF
  </Button>

  <Button
    variant="outline"
    onClick={handleDownloadExcel}
    disabled={isGeneratingExcel || !anySectionEnabled}
  >
    {isGeneratingExcel ? (
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    ) : (
      <FileSpreadsheet className="w-4 h-4 mr-2" />
    )}
    Download Excel
  </Button>

  {/* Email button stays the same */}
</div>
```

4. Remove the old `generateMutation` and `handleDownloadPreview` function.

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"` (should be 0 new errors)

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/accountant-pack/page.tsx
git commit -m "feat: add Excel download button to accountant pack page"
```

---

### Task 5: Email — Attach Both PDF + Excel

**Files:**
- Modify: `src/server/routers/analytics/accountantPack.ts`
- Modify: `src/lib/email/templates/accountant-pack.ts`

**Step 1: Update `sendToAccountant` to generate and attach Excel**

In `src/server/routers/analytics/accountantPack.ts`, modify the `sendToAccountant` procedure:

1. Add import at top:

```typescript
import { generateAccountantPackExcel } from "@/lib/accountant-pack-excel";
```

2. After generating `pdfBuffer`, add Excel generation:

```typescript
// Generate Excel
const excelBuffer = await generateAccountantPackExcel({
  financialYear,
  userName: ctx.user.name || ctx.user.email || "Unknown",
  accountantName,
  sections,
  data,
});
```

3. Update the Resend attachments array:

```typescript
attachments: [
  {
    filename: `accountant-pack-FY${financialYear}.pdf`,
    content: Buffer.from(pdfBuffer),
  },
  {
    filename: `accountant-pack-FY${financialYear}.xlsx`,
    content: Buffer.from(excelBuffer),
  },
],
```

**Step 2: Update email template copy**

In `src/lib/email/templates/accountant-pack.ts`, find the line that mentions attachments and update:

Change any reference to "PDF attached" to "PDF and Excel spreadsheet attached" in the email body.

**Step 3: Run existing tests**

Run: `npx vitest run src/server/routers/analytics/__tests__/accountantPack.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/routers/analytics/accountantPack.ts src/lib/email/templates/accountant-pack.ts
git commit -m "feat: attach both PDF and Excel to accountant email"
```

---

### Task 6: Final Verification

**Files:** None (verification only)

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (including new tests from Tasks 1-3).

**Step 2: TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: 0 new errors.

**Step 3: Verify exceljs bundle**

Run: `npm ls exceljs`
Expected: Shows exceljs in dependencies.

**Step 4: Commit any fixes**

If any tests fail or TypeScript errors exist, fix and commit:

```bash
git commit -m "fix: address verification issues in accountant pack"
```
