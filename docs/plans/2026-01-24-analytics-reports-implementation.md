# Analytics & Reports Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build tax reports, portfolio monitoring dashboard, and accountant export package for Australian property investors.

**Architecture:** New `reports` tRPC router with service layer for data aggregation. Portfolio dashboard uses Recharts for visualizations. Tax reports and accountant exports generate PDF/Excel via jsPDF and xlsx libraries. All data queries filter by userId for multi-tenancy.

**Tech Stack:** Recharts (charts), jsPDF (PDF generation), xlsx (Excel generation), date-fns (date utilities)

---

## Task 1: Install Required Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install charting and export libraries**

Run:
```bash
npm install recharts jspdf xlsx
npm install -D @types/jspdf
```

Expected: Dependencies added to package.json

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts, jspdf, xlsx dependencies for reports"
```

---

## Task 2: Create Reports Service for Data Aggregation

**Files:**
- Create: `src/server/services/reports.ts`
- Create: `src/server/services/__tests__/reports.test.ts`

**Step 1: Write test for getFinancialYearSummary**

Create file `src/server/services/__tests__/reports.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getFinancialYearRange,
  calculateCategoryTotals,
  calculatePropertyMetrics,
} from "../reports";

describe("reports service", () => {
  describe("getFinancialYearRange", () => {
    it("returns correct range for FY 2025-26 (July 2025 - June 2026)", () => {
      const { startDate, endDate } = getFinancialYearRange(2026);

      expect(startDate).toBe("2025-07-01");
      expect(endDate).toBe("2026-06-30");
    });

    it("returns correct range for FY 2024-25", () => {
      const { startDate, endDate } = getFinancialYearRange(2025);

      expect(startDate).toBe("2024-07-01");
      expect(endDate).toBe("2025-06-30");
    });
  });

  describe("calculateCategoryTotals", () => {
    it("aggregates transactions by category", () => {
      const transactions = [
        { category: "rental_income", amount: "2400.00", transactionType: "income" },
        { category: "rental_income", amount: "2400.00", transactionType: "income" },
        { category: "repairs_and_maintenance", amount: "-150.00", transactionType: "expense" },
        { category: "council_rates", amount: "-500.00", transactionType: "expense" },
      ];

      const result = calculateCategoryTotals(transactions as any);

      expect(result.get("rental_income")).toBe(4800);
      expect(result.get("repairs_and_maintenance")).toBe(-150);
      expect(result.get("council_rates")).toBe(-500);
    });

    it("returns empty map for no transactions", () => {
      const result = calculateCategoryTotals([]);

      expect(result.size).toBe(0);
    });
  });

  describe("calculatePropertyMetrics", () => {
    it("calculates income, expenses, and net for a property", () => {
      const transactions = [
        { category: "rental_income", amount: "2400.00", transactionType: "income" },
        { category: "repairs_and_maintenance", amount: "-150.00", transactionType: "expense" },
        { category: "council_rates", amount: "-500.00", transactionType: "expense" },
      ];

      const result = calculatePropertyMetrics(transactions as any);

      expect(result.totalIncome).toBe(2400);
      expect(result.totalExpenses).toBe(650);
      expect(result.netIncome).toBe(1750);
      expect(result.totalDeductible).toBe(650);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm run test:unit -- src/server/services/__tests__/reports.test.ts
```

Expected: FAIL - functions not defined

**Step 3: Create reports service**

Create file `src/server/services/reports.ts`:
```typescript
import { db } from "../db";
import { transactions, properties, loans } from "../db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface FinancialYearRange {
  startDate: string;
  endDate: string;
  label: string;
}

export interface PropertyMetrics {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  totalDeductible: number;
}

export interface CategoryTotal {
  category: string;
  label: string;
  amount: number;
  isDeductible: boolean;
  atoReference?: string;
}

/**
 * Get Australian financial year date range (July 1 - June 30)
 * @param year The ending year of the financial year (e.g., 2026 for FY 2025-26)
 */
export function getFinancialYearRange(year: number): FinancialYearRange {
  return {
    startDate: `${year - 1}-07-01`,
    endDate: `${year}-06-30`,
    label: `FY ${year - 1}-${String(year).slice(-2)}`,
  };
}

/**
 * Calculate totals by category from transactions
 */
export function calculateCategoryTotals(
  txns: Array<{ category: string; amount: string; transactionType: string }>
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const t of txns) {
    const current = totals.get(t.category) || 0;
    totals.set(t.category, current + Number(t.amount));
  }

  return totals;
}

/**
 * Calculate property-level financial metrics
 */
export function calculatePropertyMetrics(
  txns: Array<{ category: string; amount: string; transactionType: string }>
): PropertyMetrics {
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalDeductible = 0;

  for (const t of txns) {
    const amount = Number(t.amount);
    if (t.transactionType === "income") {
      totalIncome += amount;
    } else if (t.transactionType === "expense") {
      totalExpenses += Math.abs(amount);
      totalDeductible += Math.abs(amount);
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    totalDeductible,
  };
}

/**
 * Get transactions for a financial year grouped by property
 */
export async function getFinancialYearTransactions(
  userId: string,
  year: number,
  propertyId?: string
) {
  const { startDate, endDate } = getFinancialYearRange(year);

  const conditions = [
    eq(transactions.userId, userId),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
  ];

  if (propertyId) {
    conditions.push(eq(transactions.propertyId, propertyId));
  }

  return db.query.transactions.findMany({
    where: and(...conditions),
    orderBy: [desc(transactions.date)],
    with: {
      property: true,
    },
  });
}

/**
 * Get all properties for a user with their loans
 */
export async function getPropertiesWithLoans(userId: string) {
  return db.query.properties.findMany({
    where: eq(properties.userId, userId),
    with: {
      loans: true,
    },
  });
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:unit -- src/server/services/__tests__/reports.test.ts
```

Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/server/services/reports.ts src/server/services/__tests__/reports.test.ts
git commit -m "feat: add reports service with financial year calculations"
```

---

## Task 3: Create Reports tRPC Router

**Files:**
- Create: `src/server/routers/reports.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create reports router**

Create file `src/server/routers/reports.ts`:
```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { transactions, properties } from "../db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  getFinancialYearRange,
  calculateCategoryTotals,
  calculatePropertyMetrics,
  getFinancialYearTransactions,
  getPropertiesWithLoans,
} from "../services/reports";
import { categories, getCategoryInfo } from "@/lib/categories";

export const reportsRouter = router({
  /**
   * Get available financial years based on user's transactions
   */
  getAvailableYears: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        minDate: sql<string>`MIN(${transactions.date})`,
        maxDate: sql<string>`MAX(${transactions.date})`,
      })
      .from(transactions)
      .where(eq(transactions.userId, ctx.user.id));

    const minDate = result[0]?.minDate;
    const maxDate = result[0]?.maxDate;

    if (!minDate || !maxDate) {
      return [];
    }

    // Calculate FY range
    const startYear = new Date(minDate).getMonth() >= 6
      ? new Date(minDate).getFullYear() + 1
      : new Date(minDate).getFullYear();
    const endYear = new Date(maxDate).getMonth() >= 6
      ? new Date(maxDate).getFullYear() + 1
      : new Date(maxDate).getFullYear();

    const years = [];
    for (let year = endYear; year >= startYear; year--) {
      const range = getFinancialYearRange(year);
      years.push({ year, label: range.label });
    }

    return years;
  }),

  /**
   * Get tax report data for a financial year
   */
  taxReport: protectedProcedure
    .input(
      z.object({
        year: z.number().min(2000).max(2100),
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { year, propertyId } = input;
      const { startDate, endDate, label } = getFinancialYearRange(year);

      // Get all user properties
      const userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.user.id),
      });

      // Get transactions for the financial year
      const txns = await getFinancialYearTransactions(
        ctx.user.id,
        year,
        propertyId
      );

      // Group transactions by property
      const byProperty = new Map<string, typeof txns>();
      for (const t of txns) {
        if (t.propertyId) {
          const existing = byProperty.get(t.propertyId) || [];
          existing.push(t);
          byProperty.set(t.propertyId, existing);
        }
      }

      // Calculate metrics per property
      const propertyReports = userProperties
        .filter((p) => !propertyId || p.id === propertyId)
        .map((property) => {
          const propertyTxns = byProperty.get(property.id) || [];
          const metrics = calculatePropertyMetrics(propertyTxns);
          const categoryTotals = calculateCategoryTotals(propertyTxns);

          // Build ATO category breakdown
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

      // Calculate totals across all properties
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
    }),

  /**
   * Get portfolio summary for dashboard
   */
  portfolioSummary: protectedProcedure
    .input(
      z.object({
        period: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
        months: z.number().min(1).max(24).default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const { period, months } = input;

      // Get properties with loans
      const userProperties = await getPropertiesWithLoans(ctx.user.id);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get transactions in range
      const txns = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.user.id),
          gte(transactions.date, startDate.toISOString().split("T")[0]),
          lte(transactions.date, endDate.toISOString().split("T")[0])
        ),
        orderBy: [desc(transactions.date)],
        with: {
          property: true,
        },
      });

      // Group by month
      const byMonth = new Map<string, typeof txns>();
      for (const t of txns) {
        const monthKey = t.date.slice(0, 7); // YYYY-MM
        const existing = byMonth.get(monthKey) || [];
        existing.push(t);
        byMonth.set(monthKey, existing);
      }

      // Calculate monthly metrics
      const monthlyData = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, monthTxns]) => {
          const metrics = calculatePropertyMetrics(monthTxns);
          return {
            month,
            ...metrics,
          };
        });

      // Calculate totals
      const totalMetrics = calculatePropertyMetrics(txns);

      // Calculate total loan balance
      const totalLoanBalance = userProperties.reduce((sum, p) => {
        const propertyLoans = p.loans || [];
        return sum + propertyLoans.reduce((s, l) => s + Number(l.currentBalance), 0);
      }, 0);

      return {
        properties: userProperties.map((p) => ({
          id: p.id,
          address: p.address,
          purchasePrice: Number(p.purchasePrice),
          loanBalance: (p.loans || []).reduce(
            (s, l) => s + Number(l.currentBalance),
            0
          ),
        })),
        monthlyData,
        totals: {
          ...totalMetrics,
          totalLoanBalance,
          propertyCount: userProperties.length,
        },
        period,
      };
    }),
});
```

**Step 2: Add router to app router**

Modify `src/server/routers/_app.ts`:
```typescript
import { router } from "../trpc";
import { propertyRouter } from "./property";
import { transactionRouter } from "./transaction";
import { bankingRouter } from "./banking";
import { statsRouter } from "./stats";
import { loanRouter } from "./loan";
import { reportsRouter } from "./reports";

export const appRouter = router({
  property: propertyRouter,
  transaction: transactionRouter,
  banking: bankingRouter,
  stats: statsRouter,
  loan: loanRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 3: Commit**

```bash
git add src/server/routers/reports.ts src/server/routers/_app.ts
git commit -m "feat: add reports tRPC router with tax report and portfolio summary"
```

---

## Task 4: Create Reports Hub Page

**Files:**
- Create: `src/app/(dashboard)/reports/page.tsx`

**Step 1: Create reports hub page**

Create file `src/app/(dashboard)/reports/page.tsx`:
```typescript
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PieChart, Download } from "lucide-react";

const reportTypes = [
  {
    title: "Tax Report",
    description: "Generate ATO-compliant rental property tax reports for your financial year",
    icon: FileText,
    href: "/reports/tax",
  },
  {
    title: "Portfolio Dashboard",
    description: "Monitor cash flow, yields, and performance across all properties",
    icon: PieChart,
    href: "/reports/portfolio",
  },
  {
    title: "Accountant Export",
    description: "Download a complete export package for your accountant",
    icon: Download,
    href: "/reports/export",
  },
];

export default function ReportsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-muted-foreground">
          Generate reports and exports for tax time and portfolio analysis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/reports/page.tsx
git commit -m "feat: add reports hub page"
```

---

## Task 5: Create Tax Report Page

**Files:**
- Create: `src/app/(dashboard)/reports/tax/page.tsx`
- Create: `src/components/reports/TaxReportView.tsx`

**Step 1: Create TaxReportView component**

Create file `src/components/reports/TaxReportView.tsx`:
```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PropertyReport {
  property: {
    id: string;
    address: string;
    suburb: string;
    state: string;
    entityName: string;
  };
  metrics: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    totalDeductible: number;
  };
  atoBreakdown: Array<{
    category: string;
    label: string;
    amount: number;
    atoReference?: string;
    isDeductible: boolean;
  }>;
  transactionCount: number;
}

interface TaxReportData {
  financialYear: string;
  startDate: string;
  endDate: string;
  properties: PropertyReport[];
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    totalDeductible: number;
  };
  generatedAt: string;
}

interface TaxReportViewProps {
  data: TaxReportData;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

export function TaxReportView({ data }: TaxReportViewProps) {
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Summary - {data.financialYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data.totals.totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(data.totals.totalExpenses)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Income</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.totals.netIncome)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Deductible</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.totals.totalDeductible)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Property Breakdown */}
      {data.properties.map((report) => (
        <Card key={report.property.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {report.property.address}, {report.property.suburb}{" "}
              {report.property.state}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Entity: {report.property.entityName} •{" "}
              {report.transactionCount} transactions
            </p>
          </CardHeader>
          <CardContent>
            {/* Income Section */}
            <div className="mb-4">
              <h4 className="font-medium mb-2">Income</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.atoBreakdown
                    .filter((item) => !item.isDeductible && item.amount > 0)
                    .map((item) => (
                      <TableRow key={item.category}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="font-bold">
                    <TableCell>Total Income</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(report.metrics.totalIncome)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Deductions Section */}
            <div>
              <h4 className="font-medium mb-2">Deductions</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ATO Ref</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.atoBreakdown
                    .filter((item) => item.isDeductible && item.amount !== 0)
                    .map((item) => (
                      <TableRow key={item.category}>
                        <TableCell className="text-muted-foreground">
                          {item.atoReference || "-"}
                        </TableCell>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Math.abs(item.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="font-bold">
                    <TableCell></TableCell>
                    <TableCell>Total Deductions</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.metrics.totalDeductible)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Net Result */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-bold">Net Rental Income</span>
                <span
                  className={`text-xl font-bold ${
                    report.metrics.netIncome >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(report.metrics.netIncome)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Create tax report page**

Create file `src/app/(dashboard)/reports/tax/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { TaxReportView } from "@/components/reports/TaxReportView";
import { FileText, Download, Loader2 } from "lucide-react";

export default function TaxReportPage() {
  const currentYear = new Date().getMonth() >= 6
    ? new Date().getFullYear() + 1
    : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");

  const { data: availableYears, isLoading: yearsLoading } =
    trpc.reports.getAvailableYears.useQuery();

  const { data: properties } = trpc.property.list.useQuery();

  const {
    data: taxReport,
    isLoading: reportLoading,
    refetch,
  } = trpc.reports.taxReport.useQuery(
    {
      year: selectedYear,
      propertyId: selectedProperty === "all" ? undefined : selectedProperty,
    },
    { enabled: !!selectedYear }
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Report</h2>
        <p className="text-muted-foreground">
          Generate ATO-compliant rental property tax reports
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Financial Year</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {yearsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : availableYears && availableYears.length > 0 ? (
                    availableYears.map((y) => (
                      <SelectItem key={y.year} value={String(y.year)}>
                        {y.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(currentYear)}>
                      FY {currentYear - 1}-{String(currentYear).slice(-2)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={selectedProperty}
                onValueChange={setSelectedProperty}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
              <Button variant="outline" disabled={!taxReport}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report View */}
      {reportLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Generating report...</p>
            </div>
          </CardContent>
        </Card>
      ) : taxReport ? (
        <TaxReportView data={taxReport} />
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>Select a financial year to generate your tax report</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/reports/tax/page.tsx src/components/reports/TaxReportView.tsx
git commit -m "feat: add tax report page with ATO breakdown"
```

---

## Task 6: Create Portfolio Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/reports/portfolio/page.tsx`
- Create: `src/components/reports/CashFlowChart.tsx`

**Step 1: Create CashFlowChart component**

Create file `src/components/reports/CashFlowChart.tsx`:
```typescript
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

interface CashFlowChartProps {
  data: MonthlyData[];
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${monthNames[Number(m) - 1]} ${year.slice(-2)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    month: formatMonth(d.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => formatCurrency(v)}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelStyle={{ fontWeight: "bold" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="totalIncome"
          name="Income"
          stroke="#22c55e"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="totalExpenses"
          name="Expenses"
          stroke="#ef4444"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="netIncome"
          name="Net"
          stroke="#3b82f6"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Step 2: Create portfolio dashboard page**

Create file `src/app/(dashboard)/reports/portfolio/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { CashFlowChart } from "@/components/reports/CashFlowChart";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Loader2,
} from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

export default function PortfolioDashboardPage() {
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "annual">(
    "monthly"
  );
  const [months, setMonths] = useState<number>(12);

  const { data, isLoading } = trpc.reports.portfolioSummary.useQuery({
    period,
    months,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor performance across all your properties
          </p>
        </div>

        <div className="flex gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Period</Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as typeof period)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Range</Label>
            <Select
              value={String(months)}
              onValueChange={(v) => setMonths(Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="12">12 months</SelectItem>
                <SelectItem value="24">24 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Properties</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.totals.propertyCount}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Income
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.totals.totalIncome)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last {months} months
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Expenses
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.totals.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last {months} months
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Income</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    data.totals.netIncome >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(data.totals.netIncome)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last {months} months
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {data.monthlyData.length > 0 ? (
                <CashFlowChart data={data.monthlyData} />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No transaction data available for this period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Property List */}
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.properties.map((property) => (
                  <div
                    key={property.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{property.address}</p>
                      <p className="text-sm text-muted-foreground">
                        Purchase: {formatCurrency(property.purchasePrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Loan Balance
                      </p>
                      <p className="font-medium">
                        {formatCurrency(property.loanBalance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/reports/portfolio/page.tsx src/components/reports/CashFlowChart.tsx
git commit -m "feat: add portfolio dashboard with cash flow chart"
```

---

## Task 7: Create Accountant Export Page

**Files:**
- Create: `src/app/(dashboard)/reports/export/page.tsx`
- Create: `src/lib/export-utils.ts`

**Step 1: Create export utilities**

Create file `src/lib/export-utils.ts`:
```typescript
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

interface TaxReportData {
  financialYear: string;
  properties: Array<{
    property: {
      address: string;
      suburb: string;
      state: string;
      entityName: string;
    };
    metrics: {
      totalIncome: number;
      totalExpenses: number;
      netIncome: number;
      totalDeductible: number;
    };
    atoBreakdown: Array<{
      label: string;
      amount: number;
      atoReference?: string;
      isDeductible: boolean;
    }>;
  }>;
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    totalDeductible: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

export function generateTaxReportPDF(data: TaxReportData): Blob {
  const doc = new jsPDF();
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.text(`Rental Property Tax Report - ${data.financialYear}`, 20, y);
  y += 15;

  // Summary
  doc.setFontSize(14);
  doc.text("Summary", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Total Income: ${formatCurrency(data.totals.totalIncome)}`, 20, y);
  y += 6;
  doc.text(`Total Deductions: ${formatCurrency(data.totals.totalDeductible)}`, 20, y);
  y += 6;
  doc.text(`Net Rental Income: ${formatCurrency(data.totals.netIncome)}`, 20, y);
  y += 15;

  // Per Property
  for (const report of data.properties) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.text(
      `${report.property.address}, ${report.property.suburb} ${report.property.state}`,
      20,
      y
    );
    y += 6;

    doc.setFontSize(9);
    doc.text(`Entity: ${report.property.entityName}`, 20, y);
    y += 8;

    // Income
    const income = report.atoBreakdown.filter((i) => !i.isDeductible && i.amount > 0);
    if (income.length > 0) {
      doc.text("Income:", 20, y);
      y += 5;
      for (const item of income) {
        doc.text(`  ${item.label}: ${formatCurrency(item.amount)}`, 20, y);
        y += 5;
      }
    }

    // Deductions
    const deductions = report.atoBreakdown.filter((i) => i.isDeductible && i.amount !== 0);
    if (deductions.length > 0) {
      doc.text("Deductions:", 20, y);
      y += 5;
      for (const item of deductions) {
        const ref = item.atoReference ? `[${item.atoReference}] ` : "";
        doc.text(`  ${ref}${item.label}: ${formatCurrency(Math.abs(item.amount))}`, 20, y);
        y += 5;
      }
    }

    doc.text(`Net: ${formatCurrency(report.metrics.netIncome)}`, 20, y);
    y += 15;
  }

  // Footer
  doc.setFontSize(8);
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-AU")} by PropertyTracker`,
    20,
    285
  );

  return doc.output("blob");
}

export function generateTransactionsExcel(
  transactions: Array<{
    date: string;
    description: string;
    amount: string;
    category: string;
    property?: { address: string } | null;
    isDeductible: boolean;
    isVerified: boolean;
  }>,
  financialYear: string
): Blob {
  const data = transactions.map((t) => ({
    Date: t.date,
    Property: t.property?.address || "Unassigned",
    Description: t.description,
    Amount: Number(t.amount),
    Category: t.category,
    Deductible: t.isDeductible ? "Yes" : "No",
    Verified: t.isVerified ? "Yes" : "No",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, financialYear);

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Step 2: Create accountant export page**

Create file `src/app/(dashboard)/reports/export/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc/client";
import {
  generateTaxReportPDF,
  generateTransactionsExcel,
  downloadBlob,
} from "@/lib/export-utils";
import { Download, FileSpreadsheet, FileText, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export default function AccountantExportPage() {
  const currentYear =
    new Date().getMonth() >= 6
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [includePDF, setIncludePDF] = useState(true);
  const [includeExcel, setIncludeExcel] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();
  const { data: taxReport } = trpc.reports.taxReport.useQuery(
    { year: selectedYear },
    { enabled: !!selectedYear }
  );

  const handleExportPDF = async () => {
    if (!taxReport) return;

    try {
      const blob = generateTaxReportPDF(taxReport);
      downloadBlob(blob, `tax-report-${taxReport.financialYear}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      toast.error("Failed to generate PDF");
    }
  };

  const handleExportExcel = async () => {
    if (!taxReport) return;

    try {
      // Get all transactions for the FY
      const transactions = taxReport.properties.flatMap((p) =>
        p.atoBreakdown.map((item) => ({
          date: "",
          description: item.label,
          amount: String(item.amount),
          category: item.label,
          property: p.property,
          isDeductible: item.isDeductible,
          isVerified: true,
        }))
      );

      const blob = generateTransactionsExcel(transactions, taxReport.financialYear);
      downloadBlob(blob, `transactions-${taxReport.financialYear}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (error) {
      toast.error("Failed to generate Excel");
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      if (includePDF) await handleExportPDF();
      if (includeExcel) await handleExportExcel();
      toast.success("Export package complete");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Accountant Export</h2>
        <p className="text-muted-foreground">
          Generate a complete export package for your accountant
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>
            Select the financial year and files to include
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

          {/* File Selection */}
          <div className="space-y-4">
            <Label>Include in Export</Label>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="pdf"
                checked={includePDF}
                onCheckedChange={(checked) => setIncludePDF(checked === true)}
              />
              <label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                <span>Tax Summary (PDF)</span>
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="excel"
                checked={includeExcel}
                onCheckedChange={(checked) => setIncludeExcel(checked === true)}
              />
              <label htmlFor="excel" className="flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                <span>Transaction Details (Excel)</span>
              </label>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleExportAll}
              disabled={isExporting || (!includePDF && !includeExcel) || !taxReport}
              className="flex-1"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              Export Package
            </Button>
          </div>

          {/* Individual Downloads */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Or download individually:
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={!taxReport}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!taxReport}
              >
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {taxReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview - {taxReport.financialYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p>
                <strong>Properties:</strong> {taxReport.properties.length}
              </p>
              <p>
                <strong>Total Income:</strong>{" "}
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: "AUD",
                }).format(taxReport.totals.totalIncome)}
              </p>
              <p>
                <strong>Total Deductions:</strong>{" "}
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: "AUD",
                }).format(taxReport.totals.totalDeductible)}
              </p>
              <p>
                <strong>Net Rental Income:</strong>{" "}
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: "AUD",
                }).format(taxReport.totals.netIncome)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/reports/export/page.tsx src/lib/export-utils.ts
git commit -m "feat: add accountant export page with PDF and Excel generation"
```

---

## Task 8: Add Reports Link to Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Read current sidebar**

Read `src/components/layout/Sidebar.tsx` to understand the navigation structure.

**Step 2: Add reports navigation item**

Add a new navigation item for Reports with the BarChart3 icon, positioned after Transactions.

The navigation item should be:
```typescript
{
  name: "Reports",
  href: "/reports",
  icon: BarChart3,
}
```

Import `BarChart3` from `lucide-react`.

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add reports link to sidebar navigation"
```

---

## Task 9: Add Unit Tests for Reports Router

**Files:**
- Create: `src/server/routers/__tests__/reports.test.ts`

**Step 1: Create reports router tests**

Create file `src/server/routers/__tests__/reports.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("reports router", () => {
  const mockUser = {
    id: "user-1",
    clerkId: "clerk_123",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("getAvailableYears", () => {
    it("returns empty array when no transactions", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ minDate: null, maxDate: null }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.reports.getAvailableYears();

      expect(result).toEqual([]);
    });
  });

  describe("taxReport", () => {
    it("returns report structure with properties and totals", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const mockProperties = [
        {
          id: "prop-1",
          userId: "user-1",
          address: "123 Main St",
          suburb: "Sydney",
          state: "NSW",
          entityName: "Personal",
        },
      ];

      const mockTransactions = [
        {
          id: "tx-1",
          userId: "user-1",
          propertyId: "prop-1",
          date: "2025-08-15",
          description: "Rent",
          amount: "2400.00",
          category: "rental_income",
          transactionType: "income",
          property: mockProperties[0],
        },
      ];

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          properties: { findMany: vi.fn().mockResolvedValue(mockProperties) },
          transactions: { findMany: vi.fn().mockResolvedValue(mockTransactions) },
        },
      };

      const caller = createTestCaller(ctx);
      const result = await caller.reports.taxReport({ year: 2026 });

      expect(result.financialYear).toBe("FY 2025-26");
      expect(result.properties).toHaveLength(1);
      expect(result.totals.totalIncome).toBe(2400);
    });
  });
});
```

**Step 2: Run tests**

Run:
```bash
npm run test:unit -- src/server/routers/__tests__/reports.test.ts
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/reports.test.ts
git commit -m "test: add unit tests for reports router"
```

---

## Task 10: Final Verification and Documentation

**Step 1: Run all tests**

Run:
```bash
npm run test:unit
```

Expected: All tests pass

**Step 2: Run type check**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Test manually**

Run:
```bash
npm run dev
```

Verify:
1. Navigate to /reports - hub page loads
2. Navigate to /reports/tax - can select year and generate report
3. Navigate to /reports/portfolio - chart and stats display
4. Navigate to /reports/export - can download PDF and Excel

**Step 4: Final commit**

```bash
git add -A
git commit -m "docs: complete analytics and reports implementation"
```

---

## Summary

This plan implements:

1. **Reports Service** - Financial year calculations, category totals, property metrics
2. **Reports tRPC Router** - getAvailableYears, taxReport, portfolioSummary endpoints
3. **Reports Hub Page** - Landing page with links to all report types
4. **Tax Report Page** - ATO-compliant breakdown by property and category
5. **Portfolio Dashboard** - Cash flow chart, summary stats, property list
6. **Accountant Export** - PDF and Excel generation with download
7. **Navigation** - Reports link in sidebar
8. **Tests** - Unit tests for service and router

After completing all tasks, verify with:

```bash
npm run lint && npx tsc --noEmit && npm run test:unit
```
