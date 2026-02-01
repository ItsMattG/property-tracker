# MyTax Report Export — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive MyTax export page that aggregates property transactions, tax profile, and depreciation data into ATO-aligned sections with a review checklist and PDF export.

**Architecture:** New tRPC router (`mytax`) calls a service that aggregates existing data (transactions, taxProfiles, depreciationSchedules) into MyTax Item 21 structure. Client-side page renders an interactive checklist with localStorage persistence. PDF generated client-side via existing jsPDF utilities.

**Tech Stack:** Next.js page, tRPC router, Drizzle ORM queries, jsPDF for PDF, localStorage for checklist state, shadcn/ui components.

---

### Task 1: MyTax Service — ATO Mapping & Data Aggregation

**Files:**
- Create: `src/server/services/mytax.ts`
- Test: `src/server/services/__tests__/mytax.test.ts`
- Reference: `src/lib/categories.ts` (ATO codes D1-D18), `src/server/services/reports.ts` (getFinancialYearRange, getFinancialYearTransactions, calculateCategoryTotals)

**Step 1: Write the failing tests**

Create `src/server/services/__tests__/mytax.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    query: {
      properties: { findMany: vi.fn().mockResolvedValue([]) },
      taxProfiles: { findFirst: vi.fn().mockResolvedValue(null) },
      depreciationSchedules: { findMany: vi.fn().mockResolvedValue([]) },
    },
  },
}));

vi.mock("../reports", () => ({
  getFinancialYearRange: vi.fn().mockReturnValue({
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    label: "FY 2025-26",
  }),
  getFinancialYearTransactions: vi.fn().mockResolvedValue([]),
  calculateCategoryTotals: vi.fn().mockReturnValue(new Map()),
}));

import { buildMyTaxReport, type MyTaxReport } from "../mytax";

describe("mytax service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildMyTaxReport", () => {
    it("returns empty report when no data", async () => {
      const report = await buildMyTaxReport("user-1", 2026);
      expect(report.financialYear).toBe("FY 2025-26");
      expect(report.properties).toEqual([]);
      expect(report.personalSummary).toBeNull();
      expect(report.totalIncome).toBe(0);
      expect(report.totalDeductions).toBe(0);
      expect(report.netRentalResult).toBe(0);
    });

    it("aggregates income and deductions per property", async () => {
      const { getFinancialYearTransactions, calculateCategoryTotals } =
        await import("../reports");
      const { db } = await import("@/server/db");

      const mockProps = [
        { id: "p1", address: "1 Main St", suburb: "Sydney", state: "NSW", entityName: "Personal" },
      ];
      vi.mocked(db.query.properties.findMany).mockResolvedValue(mockProps as any);

      const mockTxns = [
        { id: "t1", propertyId: "p1", category: "rental_income", amount: "2400", transactionType: "income" },
        { id: "t2", propertyId: "p1", category: "insurance", amount: "-500", transactionType: "expense" },
      ];
      vi.mocked(getFinancialYearTransactions).mockResolvedValue(mockTxns as any);

      const catTotals = new Map([
        ["rental_income", 2400],
        ["insurance", -500],
      ]);
      vi.mocked(calculateCategoryTotals).mockReturnValue(catTotals);

      const report = await buildMyTaxReport("user-1", 2026);
      expect(report.properties).toHaveLength(1);
      expect(report.properties[0].address).toBe("1 Main St");
      expect(report.properties[0].income).toHaveLength(1);
      expect(report.properties[0].income[0].amount).toBe(2400);
      expect(report.properties[0].deductions).toHaveLength(1);
      expect(report.properties[0].deductions[0].atoCode).toBe("D7");
    });

    it("includes tax profile when available", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.query.taxProfiles.findFirst).mockResolvedValue({
        grossSalary: "85000",
        paygWithheld: "20000",
        otherDeductions: "1500",
        hasHecsDebt: true,
        hasPrivateHealth: false,
        familyStatus: "single",
        dependentChildren: 0,
        partnerIncome: null,
      } as any);

      const report = await buildMyTaxReport("user-1", 2026);
      expect(report.personalSummary).not.toBeNull();
      expect(report.personalSummary!.grossSalary).toBe(85000);
      expect(report.personalSummary!.paygWithheld).toBe(20000);
    });

    it("includes depreciation when schedules exist", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.query.properties.findMany).mockResolvedValue([
        { id: "p1", address: "1 Main St", suburb: "Sydney", state: "NSW", entityName: "Personal" },
      ] as any);

      vi.mocked(db.query.depreciationSchedules.findMany).mockResolvedValue([
        {
          id: "ds1",
          propertyId: "p1",
          assets: [
            { category: "capital_works", yearlyDeduction: "5000" },
            { category: "plant_equipment", yearlyDeduction: "2000" },
          ],
        },
      ] as any);

      const report = await buildMyTaxReport("user-1", 2026);
      const prop = report.properties.find((p) => p.propertyId === "p1");
      expect(prop).toBeDefined();
      expect(prop!.depreciation.capitalWorks).toBe(5000);
      expect(prop!.depreciation.plantEquipment).toBe(2000);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/__tests__/mytax.test.ts`
Expected: FAIL — module `../mytax` not found.

**Step 3: Write the implementation**

Create `src/server/services/mytax.ts`:

```typescript
import { db } from "@/server/db";
import { properties, taxProfiles, depreciationSchedules } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { categories } from "@/lib/categories";
import {
  getFinancialYearRange,
  getFinancialYearTransactions,
  calculateCategoryTotals,
} from "./reports";
import { calculateTaxPosition, type TaxPositionInput } from "./tax-position";

// --- Types ---

export interface MyTaxLineItem {
  label: string;
  atoCode: string;
  category: string;
  amount: number;
  transactionCount: number;
}

export interface MyTaxPropertyReport {
  propertyId: string;
  address: string;
  suburb: string;
  state: string;
  entityName: string;
  income: MyTaxLineItem[];
  deductions: MyTaxLineItem[];
  depreciation: {
    capitalWorks: number;
    plantEquipment: number;
  };
  totalIncome: number;
  totalDeductions: number;
  netResult: number;
}

export interface MyTaxPersonalSummary {
  grossSalary: number;
  paygWithheld: number;
  otherDeductions: number;
  hasHecsDebt: boolean;
  hasPrivateHealth: boolean;
  taxPosition: {
    taxableIncome: number;
    baseTax: number;
    medicareLevy: number;
    medicareLevySurcharge: number;
    hecsRepayment: number;
    totalTaxLiability: number;
    refundOrOwing: number;
    isRefund: boolean;
  } | null;
}

export interface MyTaxReport {
  financialYear: string;
  fyNumber: number;
  startDate: string;
  endDate: string;
  properties: MyTaxPropertyReport[];
  personalSummary: MyTaxPersonalSummary | null;
  totalIncome: number;
  totalDeductions: number;
  netRentalResult: number;
  generatedAt: string;
}

// --- Helpers ---

const incomeCategories = categories.filter((c) => c.type === "income");
const deductibleCategories = categories.filter((c) => c.isDeductible);

function buildLineItems(
  categoryList: typeof categories,
  totals: Map<string, number>,
  txns: Array<{ category: string }>
): MyTaxLineItem[] {
  return categoryList
    .map((cat) => ({
      label: cat.label,
      atoCode: cat.atoReference || "",
      category: cat.value,
      amount: Math.abs(totals.get(cat.value) || 0),
      transactionCount: txns.filter((t) => t.category === cat.value).length,
    }))
    .filter((item) => item.amount > 0);
}

// --- Main ---

export async function buildMyTaxReport(
  userId: string,
  year: number
): Promise<MyTaxReport> {
  const { startDate, endDate, label } = getFinancialYearRange(year);

  // Fetch all data in parallel
  const [userProperties, allTxns, taxProfile, depreciation] = await Promise.all([
    db.query.properties.findMany({
      where: eq(properties.userId, userId),
    }),
    getFinancialYearTransactions(userId, year),
    db.query.taxProfiles.findFirst({
      where: and(
        eq(taxProfiles.userId, userId),
        eq(taxProfiles.financialYear, year)
      ),
    }),
    db.query.depreciationSchedules.findMany({
      where: eq(depreciationSchedules.userId, userId),
      with: { assets: true },
    }),
  ]);

  // Group transactions by property
  const txnsByProperty = new Map<string, typeof allTxns>();
  for (const t of allTxns) {
    if (t.propertyId) {
      const existing = txnsByProperty.get(t.propertyId) || [];
      existing.push(t);
      txnsByProperty.set(t.propertyId, existing);
    }
  }

  // Build depreciation lookup by property
  const depByProperty = new Map<string, { capitalWorks: number; plantEquipment: number }>();
  for (const schedule of depreciation) {
    const assets = (schedule as any).assets || [];
    let cw = 0;
    let pe = 0;
    for (const asset of assets) {
      const deduction = Number(asset.yearlyDeduction) || 0;
      if (asset.category === "capital_works") {
        cw += deduction;
      } else {
        pe += deduction;
      }
    }
    const existing = depByProperty.get(schedule.propertyId) || { capitalWorks: 0, plantEquipment: 0 };
    depByProperty.set(schedule.propertyId, {
      capitalWorks: existing.capitalWorks + cw,
      plantEquipment: existing.plantEquipment + pe,
    });
  }

  // Build per-property reports
  const propertyReports: MyTaxPropertyReport[] = userProperties.map((prop) => {
    const propTxns = txnsByProperty.get(prop.id) || [];
    const catTotals = calculateCategoryTotals(propTxns as any);
    const dep = depByProperty.get(prop.id) || { capitalWorks: 0, plantEquipment: 0 };

    const income = buildLineItems(incomeCategories, catTotals, propTxns as any);
    const deductions = buildLineItems(deductibleCategories, catTotals, propTxns as any);

    const totalIncome = income.reduce((s, i) => s + i.amount, 0);
    const totalDeductions =
      deductions.reduce((s, d) => s + d.amount, 0) +
      dep.capitalWorks +
      dep.plantEquipment;

    return {
      propertyId: prop.id,
      address: prop.address,
      suburb: prop.suburb || "",
      state: prop.state || "",
      entityName: prop.entityName || "Personal",
      income,
      deductions,
      depreciation: dep,
      totalIncome,
      totalDeductions,
      netResult: totalIncome - totalDeductions,
    };
  });

  // Portfolio totals
  const totalIncome = propertyReports.reduce((s, p) => s + p.totalIncome, 0);
  const totalDeductions = propertyReports.reduce((s, p) => s + p.totalDeductions, 0);
  const netRentalResult = totalIncome - totalDeductions;

  // Personal summary from tax profile
  let personalSummary: MyTaxPersonalSummary | null = null;
  if (taxProfile) {
    const grossSalary = Number(taxProfile.grossSalary) || 0;
    const paygWithheld = Number(taxProfile.paygWithheld) || 0;
    const otherDeductions = Number(taxProfile.otherDeductions) || 0;

    let taxPosition: MyTaxPersonalSummary["taxPosition"] = null;
    try {
      const result = calculateTaxPosition({
        financialYear: year,
        grossSalary,
        paygWithheld,
        rentalNetResult: netRentalResult,
        otherDeductions,
        hasHecsDebt: taxProfile.hasHecsDebt,
        hasPrivateHealth: taxProfile.hasPrivateHealth,
        familyStatus: taxProfile.familyStatus as "single" | "couple" | "family",
        dependentChildren: taxProfile.dependentChildren,
        partnerIncome: Number(taxProfile.partnerIncome) || 0,
      });
      taxPosition = {
        taxableIncome: result.taxableIncome,
        baseTax: result.baseTax,
        medicareLevy: result.medicareLevy,
        medicareLevySurcharge: result.medicareLevySurcharge,
        hecsRepayment: result.hecsRepayment,
        totalTaxLiability: result.totalTaxLiability,
        refundOrOwing: result.refundOrOwing,
        isRefund: result.isRefund,
      };
    } catch {
      // Tax tables might not be available for this FY
    }

    personalSummary = {
      grossSalary,
      paygWithheld,
      otherDeductions,
      hasHecsDebt: taxProfile.hasHecsDebt,
      hasPrivateHealth: taxProfile.hasPrivateHealth,
      taxPosition,
    };
  }

  return {
    financialYear: label,
    fyNumber: year,
    startDate,
    endDate,
    properties: propertyReports,
    personalSummary,
    totalIncome,
    totalDeductions,
    netRentalResult,
    generatedAt: new Date().toISOString(),
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/mytax.test.ts`
Expected: PASS — all 4 tests pass.

**Step 5: Commit**

```bash
git add src/server/services/mytax.ts src/server/services/__tests__/mytax.test.ts
git commit -m "feat(mytax): add service for ATO MyTax report aggregation"
```

---

### Task 2: MyTax tRPC Router

**Files:**
- Create: `src/server/routers/mytax.ts`
- Modify: `src/server/routers/_app.ts` (line 88 area — add `mytax: mytaxRouter`)
- Test: `src/server/routers/__tests__/mytax.test.ts`
- Reference: `src/server/routers/reports.ts` (pattern), `src/server/__tests__/test-utils.ts` (test utilities)

**Step 1: Write the failing test**

Create `src/server/routers/__tests__/mytax.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

vi.mock("../../services/mytax", () => ({
  buildMyTaxReport: vi.fn(),
}));

import { buildMyTaxReport } from "../../services/mytax";

const mockUser = {
  id: "user-1",
  clerkId: "clerk_123",
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("mytax router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getReport", () => {
    it("returns MyTax report for given year", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
      } as any;

      const mockReport = {
        financialYear: "FY 2025-26",
        fyNumber: 2026,
        startDate: "2025-07-01",
        endDate: "2026-06-30",
        properties: [],
        personalSummary: null,
        totalIncome: 0,
        totalDeductions: 0,
        netRentalResult: 0,
        generatedAt: "2026-01-28T00:00:00.000Z",
      };

      vi.mocked(buildMyTaxReport).mockResolvedValue(mockReport);

      const caller = createTestCaller(ctx);
      const result = await caller.mytax.getReport({ year: 2026 });

      expect(result.financialYear).toBe("FY 2025-26");
      expect(buildMyTaxReport).toHaveBeenCalledWith("user-1", 2026);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/__tests__/mytax.test.ts`
Expected: FAIL — `mytax` not found on router.

**Step 3: Write the router**

Create `src/server/routers/mytax.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildMyTaxReport } from "../services/mytax";

export const mytaxRouter = router({
  getReport: protectedProcedure
    .input(
      z.object({
        year: z.number().min(2000).max(2100),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildMyTaxReport(ctx.portfolio.ownerId, input.year);
    }),
});
```

**Step 4: Register the router**

Modify `src/server/routers/_app.ts`:

Add import after line 43 (`import { chatRouter } from "./chat";`):
```typescript
import { mytaxRouter } from "./mytax";
```

Add to the router object after line 87 (`chat: chatRouter,`):
```typescript
mytax: mytaxRouter,
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/server/routers/__tests__/mytax.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/server/routers/mytax.ts src/server/routers/_app.ts src/server/routers/__tests__/mytax.test.ts
git commit -m "feat(mytax): add tRPC router for MyTax report"
```

---

### Task 3: MyTax PDF Generation

**Files:**
- Create: `src/lib/mytax-pdf.ts`
- Test: `src/server/services/__tests__/mytax-pdf.test.ts`
- Reference: `src/lib/export-utils.ts` (existing jsPDF pattern)

**Step 1: Write the failing test**

Create `src/server/services/__tests__/mytax-pdf.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock jsPDF
vi.mock("jspdf", () => {
  const mockDoc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    line: vi.fn(),
    output: vi.fn().mockReturnValue(new Blob(["pdf-content"])),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  };
  return { default: vi.fn(() => mockDoc) };
});

import { generateMyTaxPDF } from "@/lib/mytax-pdf";
import type { MyTaxReport } from "../../services/mytax";

describe("generateMyTaxPDF", () => {
  const emptyReport: MyTaxReport = {
    financialYear: "FY 2025-26",
    fyNumber: 2026,
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    properties: [],
    personalSummary: null,
    totalIncome: 0,
    totalDeductions: 0,
    netRentalResult: 0,
    generatedAt: "2026-01-28T00:00:00.000Z",
  };

  it("returns a Blob", () => {
    const result = generateMyTaxPDF(emptyReport);
    expect(result).toBeInstanceOf(Blob);
  });

  it("generates PDF for report with properties", () => {
    const report: MyTaxReport = {
      ...emptyReport,
      properties: [
        {
          propertyId: "p1",
          address: "1 Main St",
          suburb: "Sydney",
          state: "NSW",
          entityName: "Personal",
          income: [
            { label: "Rental Income", atoCode: "", category: "rental_income", amount: 24000, transactionCount: 12 },
          ],
          deductions: [
            { label: "Insurance", atoCode: "D7", category: "insurance", amount: 1200, transactionCount: 1 },
          ],
          depreciation: { capitalWorks: 5000, plantEquipment: 2000 },
          totalIncome: 24000,
          totalDeductions: 8200,
          netResult: 15800,
        },
      ],
      totalIncome: 24000,
      totalDeductions: 8200,
      netRentalResult: 15800,
    };

    const result = generateMyTaxPDF(report);
    expect(result).toBeInstanceOf(Blob);
  });

  it("generates PDF with personal summary", () => {
    const report: MyTaxReport = {
      ...emptyReport,
      personalSummary: {
        grossSalary: 85000,
        paygWithheld: 20000,
        otherDeductions: 1500,
        hasHecsDebt: true,
        hasPrivateHealth: false,
        taxPosition: {
          taxableIncome: 83500,
          baseTax: 18000,
          medicareLevy: 1670,
          medicareLevySurcharge: 0,
          hecsRepayment: 4175,
          totalTaxLiability: 23845,
          refundOrOwing: -3845,
          isRefund: false,
        },
      },
    };

    const result = generateMyTaxPDF(report);
    expect(result).toBeInstanceOf(Blob);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/mytax-pdf.test.ts`
Expected: FAIL — module `@/lib/mytax-pdf` not found.

**Step 3: Write the implementation**

Create `src/lib/mytax-pdf.ts`:

```typescript
import jsPDF from "jspdf";
import type { MyTaxReport, MyTaxPropertyReport } from "@/server/services/mytax";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function addPropertyPage(doc: jsPDF, prop: MyTaxPropertyReport, y: number): number {
  // Property header
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${prop.address}, ${prop.suburb} ${prop.state}`, 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Entity: ${prop.entityName}`, 20, y);
  y += 10;

  // Income section
  if (prop.income.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Income", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const item of prop.income) {
      doc.text(item.label, 25, y);
      doc.text(formatCurrency(item.amount), 160, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Deductions section
  if (prop.deductions.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Deductions (Item 21)", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const item of prop.deductions) {
      const ref = item.atoCode ? `[${item.atoCode}] ` : "";
      doc.text(`${ref}${item.label}`, 25, y);
      doc.text(formatCurrency(item.amount), 160, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Depreciation
  if (prop.depreciation.capitalWorks > 0 || prop.depreciation.plantEquipment > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Depreciation", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (prop.depreciation.capitalWorks > 0) {
      doc.text("[D14] Capital Works", 25, y);
      doc.text(formatCurrency(prop.depreciation.capitalWorks), 160, y, { align: "right" });
      y += 5;
    }
    if (prop.depreciation.plantEquipment > 0) {
      doc.text("Plant & Equipment", 25, y);
      doc.text(formatCurrency(prop.depreciation.plantEquipment), 160, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Property total
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.line(20, y, 170, y);
  y += 5;
  doc.text("Total Income:", 25, y);
  doc.text(formatCurrency(prop.totalIncome), 160, y, { align: "right" });
  y += 5;
  doc.text("Total Deductions:", 25, y);
  doc.text(formatCurrency(prop.totalDeductions), 160, y, { align: "right" });
  y += 5;
  const netLabel = prop.netResult >= 0 ? "Net Rental Income:" : "Net Rental Loss:";
  doc.text(netLabel, 25, y);
  doc.text(formatCurrency(prop.netResult), 160, y, { align: "right" });
  y += 10;

  return y;
}

export function generateMyTaxPDF(report: MyTaxReport): Blob {
  const doc = new jsPDF();
  let y = 20;

  // Cover page
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("MyTax Reference Report", 20, y);
  y += 10;
  doc.setFontSize(14);
  doc.text(report.financialYear, 20, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${report.startDate} to ${report.endDate}`, 20, y);
  y += 5;
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString("en-AU")}`, 20, y);
  y += 5;
  doc.text(`Properties: ${report.properties.length}`, 20, y);
  y += 10;

  // Disclaimer
  doc.setFontSize(8);
  doc.text(
    "This is a reference document — not an official ATO submission. Consult your tax professional.",
    20,
    y
  );
  y += 15;

  // Portfolio summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Portfolio Summary", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Rental Income: ${formatCurrency(report.totalIncome)}`, 25, y);
  y += 6;
  doc.text(`Total Deductions: ${formatCurrency(report.totalDeductions)}`, 25, y);
  y += 6;
  doc.text(`Net Rental Result: ${formatCurrency(report.netRentalResult)}`, 25, y);
  y += 15;

  // Per-property pages
  for (const prop of report.properties) {
    if (y > 200) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Item 21 — Rent on Australian Properties", 20, y);
    y += 10;
    y = addPropertyPage(doc, prop, y);
  }

  // Personal summary page
  if (report.personalSummary) {
    doc.addPage();
    y = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Personal Tax Summary", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const ps = report.personalSummary;
    doc.text(`Gross Salary/Wages: ${formatCurrency(ps.grossSalary)}`, 25, y); y += 6;
    doc.text(`PAYG Withheld: ${formatCurrency(ps.paygWithheld)}`, 25, y); y += 6;
    doc.text(`Other Deductions: ${formatCurrency(ps.otherDeductions)}`, 25, y); y += 6;
    doc.text(`Net Rental Result: ${formatCurrency(report.netRentalResult)}`, 25, y); y += 6;
    doc.text(`HECS/HELP Debt: ${ps.hasHecsDebt ? "Yes" : "No"}`, 25, y); y += 6;
    doc.text(`Private Health Insurance: ${ps.hasPrivateHealth ? "Yes" : "No"}`, 25, y); y += 10;

    if (ps.taxPosition) {
      doc.setFont("helvetica", "bold");
      doc.text("Estimated Tax Position", 20, y); y += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`Taxable Income: ${formatCurrency(ps.taxPosition.taxableIncome)}`, 25, y); y += 6;
      doc.text(`Base Tax: ${formatCurrency(ps.taxPosition.baseTax)}`, 25, y); y += 6;
      doc.text(`Medicare Levy: ${formatCurrency(ps.taxPosition.medicareLevy)}`, 25, y); y += 6;
      if (ps.taxPosition.medicareLevySurcharge > 0) {
        doc.text(`Medicare Levy Surcharge: ${formatCurrency(ps.taxPosition.medicareLevySurcharge)}`, 25, y); y += 6;
      }
      if (ps.taxPosition.hecsRepayment > 0) {
        doc.text(`HECS Repayment: ${formatCurrency(ps.taxPosition.hecsRepayment)}`, 25, y); y += 6;
      }
      doc.text(`Total Tax Liability: ${formatCurrency(ps.taxPosition.totalTaxLiability)}`, 25, y); y += 8;
      doc.setFont("helvetica", "bold");
      const resultLabel = ps.taxPosition.isRefund ? "Estimated Refund:" : "Estimated Owing:";
      doc.text(`${resultLabel} ${formatCurrency(Math.abs(ps.taxPosition.refundOrOwing))}`, 25, y);
    }
  }

  // Footer on last page
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Generated by PropertyTracker — not an official ATO document.",
    20,
    285
  );

  return doc.output("blob");
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/mytax-pdf.test.ts`
Expected: PASS — all 3 tests pass.

**Step 5: Commit**

```bash
git add src/lib/mytax-pdf.ts src/server/services/__tests__/mytax-pdf.test.ts
git commit -m "feat(mytax): add PDF generation for MyTax report"
```

---

### Task 4: Reports Page Card & Sidebar Nav

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx` (add MyTax card to `reportTypes` array around line 37)
- Modify: `src/components/layout/Sidebar.tsx` (add nav item around line 53)
- Modify: `src/server/services/chat-system-prompt.ts` (add MyTax to app navigation around line 35)

**Step 1: Add MyTax card to reports page**

In `src/app/(dashboard)/reports/page.tsx`, add `ClipboardList` to the lucide imports on line 5:

```typescript
import { FileText, PieChart, Download, TrendingUp, Calculator, ClipboardList } from "lucide-react";
```

Add to `reportTypes` array after the Cash Flow Forecast entry (after line 37):

```typescript
  {
    title: "MyTax Export",
    description: "ATO MyTax-aligned rental property report with interactive checklist",
    icon: ClipboardList,
    href: "/reports/mytax",
  },
```

**Step 2: Add MyTax to sidebar navigation**

In `src/components/layout/Sidebar.tsx`, add after the line `{ href: "/reports/brokers", label: "Broker Portal", icon: Briefcase },` (line 53):

```typescript
  { href: "/reports/mytax", label: "MyTax Export", icon: FileDown },
```

Note: `FileDown` is already imported on line 13.

**Step 3: Update chat system prompt**

In `src/server/services/chat-system-prompt.ts`, add after `- Reports: Tax position, CGT, depreciation, benchmarking` (line 35):

Change line 35 from:
```
- Reports: Tax position, CGT, depreciation, benchmarking
```
to:
```
- Reports: Tax position, CGT, depreciation, benchmarking, MyTax export
```

**Step 4: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/page.tsx src/components/layout/Sidebar.tsx src/server/services/chat-system-prompt.ts
git commit -m "feat(mytax): add MyTax card to reports page and sidebar nav"
```

---

### Task 5: MyTax Page — FY Selector & Data Loading

**Files:**
- Create: `src/app/(dashboard)/reports/mytax/page.tsx`
- Create: `src/app/(dashboard)/reports/mytax/MyTaxContent.tsx`
- Reference: `src/app/(dashboard)/reports/tax/page.tsx` (Suspense pattern), `src/app/(dashboard)/reports/tax-position/TaxPositionContent.tsx` (FY selector pattern)

**Step 1: Create the page wrapper**

Create `src/app/(dashboard)/reports/mytax/page.tsx`:

```typescript
import { Suspense } from "react";
import { MyTaxContent } from "./MyTaxContent";

export const dynamic = "force-dynamic";

function MyTaxLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">MyTax Export</h2>
        <p className="text-muted-foreground">Loading report data...</p>
      </div>
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded w-48" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  );
}

export default function MyTaxPage() {
  return (
    <Suspense fallback={<MyTaxLoading />}>
      <MyTaxContent />
    </Suspense>
  );
}
```

**Step 2: Create the content component with FY selector**

Create `src/app/(dashboard)/reports/mytax/MyTaxContent.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileDown, Info } from "lucide-react";
import { generateMyTaxPDF } from "@/lib/mytax-pdf";
import { downloadBlob } from "@/lib/export-utils";
import { MyTaxChecklist } from "./MyTaxChecklist";

export function MyTaxContent() {
  const currentFY =
    new Date().getMonth() >= 6
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentFY);

  const { data: years, isLoading: yearsLoading } =
    trpc.reports.getAvailableYears.useQuery();

  const { data: report, isLoading: reportLoading } =
    trpc.mytax.getReport.useQuery(
      { year: selectedYear },
      { enabled: !!selectedYear }
    );

  const handleExportPDF = () => {
    if (!report) return;
    const blob = generateMyTaxPDF(report);
    downloadBlob(blob, `MyTax-Report-${report.financialYear}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MyTax Export</h2>
          <p className="text-muted-foreground">
            ATO-aligned rental property report for your tax return
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select FY" />
            </SelectTrigger>
            <SelectContent>
              {yearsLoading ? (
                <SelectItem value={String(currentFY)}>
                  FY {currentFY - 1}-{String(currentFY).slice(-2)}
                </SelectItem>
              ) : (
                years?.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    {y.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleExportPDF} disabled={!report || reportLoading}>
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This is a reference document — not an official ATO submission. Consult
          your tax professional before lodging.
        </AlertDescription>
      </Alert>

      {reportLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </div>
      ) : report ? (
        report.properties.length === 0 && !report.personalSummary ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No transaction data found for {report.financialYear}. Add
              transactions to generate your MyTax report.
            </CardContent>
          </Card>
        ) : (
          <MyTaxChecklist report={report} />
        )
      ) : null}
    </div>
  );
}
```

**Step 3: Create a placeholder checklist (will be completed in Task 6)**

Create `src/app/(dashboard)/reports/mytax/MyTaxChecklist.tsx`:

```typescript
"use client";

import type { MyTaxReport } from "@/server/services/mytax";

interface MyTaxChecklistProps {
  report: MyTaxReport;
}

export function MyTaxChecklist({ report }: MyTaxChecklistProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        {report.properties.length} properties · {report.financialYear}
      </p>
    </div>
  );
}
```

**Step 4: Verify type checking**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/mytax/
git commit -m "feat(mytax): add MyTax page with FY selector and PDF export"
```

---

### Task 6: Interactive Checklist UI

**Files:**
- Modify: `src/app/(dashboard)/reports/mytax/MyTaxChecklist.tsx` (replace placeholder)
- Reference: existing shadcn components (Card, Checkbox, Collapsible, Progress)

**Step 1: Build the full checklist component**

Replace `src/app/(dashboard)/reports/mytax/MyTaxChecklist.tsx` with:

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MyTaxReport, MyTaxPropertyReport, MyTaxLineItem } from "@/server/services/mytax";

interface MyTaxChecklistProps {
  report: MyTaxReport;
}

interface ChecklistState {
  checked: Record<string, boolean>;
}

function getStorageKey(fy: number): string {
  return `mytax-checklist-${fy}`;
}

function loadState(fy: number): ChecklistState {
  if (typeof window === "undefined") return { checked: {} };
  try {
    const raw = localStorage.getItem(getStorageKey(fy));
    return raw ? JSON.parse(raw) : { checked: {} };
  } catch {
    return { checked: {} };
  }
}

function saveState(fy: number, state: ChecklistState) {
  try {
    localStorage.setItem(getStorageKey(fy), JSON.stringify(state));
  } catch {
    // localStorage full or unavailable
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function LineItemRow({
  item,
  itemKey,
  checked,
  onToggle,
}: {
  item: MyTaxLineItem;
  itemKey: string;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted/50">
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(itemKey)}
      />
      <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.atoCode && (
            <Badge variant="outline" className="text-xs font-mono">
              {item.atoCode}
            </Badge>
          )}
          <span className="text-sm">{item.label}</span>
          <span className="text-xs text-muted-foreground">
            ({item.transactionCount} txn{item.transactionCount !== 1 ? "s" : ""})
          </span>
        </div>
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(item.amount)}
        </span>
      </div>
    </div>
  );
}

function PropertySection({
  prop,
  index,
  state,
  onToggle,
}: {
  prop: MyTaxPropertyReport;
  index: number;
  state: ChecklistState;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const allKeys = [
    ...prop.income.map((_, i) => `p${index}-inc-${i}`),
    ...prop.deductions.map((_, i) => `p${index}-ded-${i}`),
    ...(prop.depreciation.capitalWorks > 0 ? [`p${index}-dep-cw`] : []),
    ...(prop.depreciation.plantEquipment > 0 ? [`p${index}-dep-pe`] : []),
  ];
  const checkedCount = allKeys.filter((k) => state.checked[k]).length;
  const hasWarning =
    prop.income.length === 0 && prop.deductions.length === 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronRight
                  className={cn(
                    "w-4 h-4 transition-transform",
                    open && "rotate-90"
                  )}
                />
                <div>
                  <CardTitle className="text-base">
                    {prop.address}, {prop.suburb} {prop.state}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {prop.entityName} · Net: {formatCurrency(prop.netResult)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasWarning && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    No data
                  </Badge>
                )}
                <Badge variant="secondary">
                  {checkedCount}/{allKeys.length}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {prop.income.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Income
                </h4>
                {prop.income.map((item, i) => (
                  <LineItemRow
                    key={i}
                    item={item}
                    itemKey={`p${index}-inc-${i}`}
                    checked={!!state.checked[`p${index}-inc-${i}`]}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            )}

            {prop.deductions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Deductions (Item 21)
                </h4>
                {prop.deductions.map((item, i) => (
                  <LineItemRow
                    key={i}
                    item={item}
                    itemKey={`p${index}-ded-${i}`}
                    checked={!!state.checked[`p${index}-ded-${i}`]}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            )}

            {(prop.depreciation.capitalWorks > 0 ||
              prop.depreciation.plantEquipment > 0) && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Depreciation
                </h4>
                {prop.depreciation.capitalWorks > 0 && (
                  <LineItemRow
                    item={{
                      label: "Capital Works",
                      atoCode: "D14",
                      category: "capital_works",
                      amount: prop.depreciation.capitalWorks,
                      transactionCount: 0,
                    }}
                    itemKey={`p${index}-dep-cw`}
                    checked={!!state.checked[`p${index}-dep-cw`]}
                    onToggle={onToggle}
                  />
                )}
                {prop.depreciation.plantEquipment > 0 && (
                  <LineItemRow
                    item={{
                      label: "Plant & Equipment",
                      atoCode: "",
                      category: "plant_equipment",
                      amount: prop.depreciation.plantEquipment,
                      transactionCount: 0,
                    }}
                    itemKey={`p${index}-dep-pe`}
                    checked={!!state.checked[`p${index}-dep-pe`]}
                    onToggle={onToggle}
                  />
                )}
              </div>
            )}

            <div className="pt-2 border-t flex justify-between text-sm font-medium">
              <span>Net Result</span>
              <span className={cn(prop.netResult < 0 ? "text-red-600" : "text-green-600")}>
                {formatCurrency(prop.netResult)}
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function MyTaxChecklist({ report }: MyTaxChecklistProps) {
  const [state, setState] = useState<ChecklistState>(() =>
    loadState(report.fyNumber)
  );

  useEffect(() => {
    saveState(report.fyNumber, state);
  }, [state, report.fyNumber]);

  const onToggle = useCallback((key: string) => {
    setState((prev) => ({
      checked: { ...prev.checked, [key]: !prev.checked[key] },
    }));
  }, []);

  // Count total and checked items
  let totalItems = 0;
  let checkedItems = 0;
  for (const [index, prop] of report.properties.entries()) {
    const keys = [
      ...prop.income.map((_, i) => `p${index}-inc-${i}`),
      ...prop.deductions.map((_, i) => `p${index}-ded-${i}`),
      ...(prop.depreciation.capitalWorks > 0 ? [`p${index}-dep-cw`] : []),
      ...(prop.depreciation.plantEquipment > 0 ? [`p${index}-dep-pe`] : []),
    ];
    totalItems += keys.length;
    checkedItems += keys.filter((k) => state.checked[k]).length;
  }
  // Personal summary counts as 1 item
  if (report.personalSummary) {
    totalItems += 1;
    if (state.checked["personal"]) checkedItems += 1;
  }

  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {checkedItems} of {totalItems} items reviewed
            </span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      {/* Portfolio summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio Summary — {report.financialYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{formatCurrency(report.totalIncome)}</p>
              <p className="text-xs text-muted-foreground">Total Income</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(report.totalDeductions)}</p>
              <p className="text-xs text-muted-foreground">Total Deductions</p>
            </div>
            <div>
              <p className={cn("text-2xl font-bold", report.netRentalResult < 0 ? "text-red-600" : "text-green-600")}>
                {formatCurrency(report.netRentalResult)}
              </p>
              <p className="text-xs text-muted-foreground">Net Rental Result</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-property sections */}
      {report.properties.map((prop, index) => (
        <PropertySection
          key={prop.propertyId}
          prop={prop}
          index={index}
          state={state}
          onToggle={onToggle}
        />
      ))}

      {/* Personal summary */}
      {report.personalSummary && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={!!state.checked["personal"]}
                onCheckedChange={() => onToggle("personal")}
              />
              <CardTitle className="text-base">Personal Tax Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Salary/Wages</span>
              <span>{formatCurrency(report.personalSummary.grossSalary)}</span>
            </div>
            <div className="flex justify-between">
              <span>PAYG Withheld</span>
              <span>{formatCurrency(report.personalSummary.paygWithheld)}</span>
            </div>
            <div className="flex justify-between">
              <span>Net Rental Result</span>
              <span className={cn(report.netRentalResult < 0 ? "text-red-600" : "text-green-600")}>
                {formatCurrency(report.netRentalResult)}
              </span>
            </div>
            {report.personalSummary.taxPosition && (
              <>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-medium">
                    <span>Estimated Taxable Income</span>
                    <span>{formatCurrency(report.personalSummary.taxPosition.taxableIncome)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-medium">
                  <span>
                    {report.personalSummary.taxPosition.isRefund
                      ? "Estimated Refund"
                      : "Estimated Owing"}
                  </span>
                  <span
                    className={cn(
                      report.personalSummary.taxPosition.isRefund
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    {formatCurrency(
                      Math.abs(report.personalSummary.taxPosition.refundOrOwing)
                    )}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Verify type checking**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/mytax/MyTaxChecklist.tsx
git commit -m "feat(mytax): add interactive review checklist with localStorage persistence"
```

---

### Task 7: Type Check, Lint, and Full Test Suite

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 2: Run lint**

Run: `npx next lint`
Expected: PASS (or fix any issues).

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass including new mytax tests.

**Step 4: Verify coverage threshold**

Check that function coverage stays ≥40%. The new service tests should help coverage.

**Step 5: Commit any fixes**

If any lint or test fixes were needed:
```bash
git add -A
git commit -m "fix(mytax): resolve lint and test issues"
```

---

### Task 8: Create PR and Merge

**Step 1: Push branch**

```bash
git push -u origin feature/mytax-report-export
```

**Step 2: Create PR**

```bash
gh pr create --title "feat(mytax): MyTax report export with ATO Item 21 mapping" --body "$(cat <<'EOF'
## Summary
- New MyTax export page at `/reports/mytax` with FY selector
- Interactive checklist with per-property Item 21 ATO-aligned breakdown
- PDF export via jsPDF with cover page, per-property, and personal summary
- tRPC router and service aggregating transactions, tax profiles, and depreciation
- Review progress tracking with localStorage persistence

## Test plan
- [ ] Unit tests for mytax service (aggregation, mapping, edge cases)
- [ ] Unit tests for PDF generation (structure, property, personal)
- [ ] Router integration test
- [ ] Manual: navigate to /reports/mytax, select FY, review checklist
- [ ] Manual: export PDF and verify contents

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Wait for CI to pass, then merge**

```bash
gh pr merge --squash --delete-branch
```
