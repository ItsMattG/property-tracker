# Audit Checks — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated report page that runs 7 automated audit checks (tax readiness + data quality) per property, computing per-property and portfolio audit scores on demand.

**Architecture:** Pure service functions compute each check from transaction and property data. A thin tRPC router exposes the audit report. A React page renders scores as color-coded badges with collapsible per-property check results.

**Tech Stack:** TypeScript, Vitest, tRPC, Drizzle ORM, Next.js App Router, shadcn/ui (Card, Collapsible, Badge, Select), Lucide icons.

---

### Task 1: Audit Check Pure Functions — Types & Scoring (TDD)

**Files:**
- Create: `src/server/services/__tests__/audit-checks.test.ts`
- Create: `src/server/services/audit-checks.ts`

**Step 1: Write the failing tests**

Create `src/server/services/__tests__/audit-checks.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeAuditScore,
  checkMissingKeyExpenses,
  checkUncategorizedTransactions,
  checkLoanInterestMissing,
  checkMissedDeductions,
  checkUnassignedTransactions,
  checkLargeUnverified,
  checkNoRentalIncome,
  type AuditCheckResult,
} from "../audit-checks";

describe("computeAuditScore", () => {
  it("returns 100 when no checks fail", () => {
    expect(computeAuditScore([])).toBe(100);
  });

  it("deducts 5 per info check", () => {
    const checks: AuditCheckResult[] = [
      { checkType: "unassigned_transactions", severity: "info", title: "t", message: "m", propertyId: null, affectedCount: 3 },
    ];
    expect(computeAuditScore(checks)).toBe(95);
  });

  it("deducts 10 per warning check", () => {
    const checks: AuditCheckResult[] = [
      { checkType: "missing_key_expense", severity: "warning", title: "t", message: "m", propertyId: "p1", affectedCount: 1 },
      { checkType: "no_rental_income", severity: "warning", title: "t", message: "m", propertyId: "p1", affectedCount: 1 },
    ];
    expect(computeAuditScore(checks)).toBe(80);
  });

  it("deducts 20 per critical check", () => {
    const checks: AuditCheckResult[] = [
      { checkType: "test", severity: "critical", title: "t", message: "m", propertyId: null, affectedCount: 1 },
    ];
    expect(computeAuditScore(checks)).toBe(80);
  });

  it("floors at zero", () => {
    const checks: AuditCheckResult[] = Array.from({ length: 20 }, (_, i) => ({
      checkType: `warn_${i}`,
      severity: "warning" as const,
      title: "t",
      message: "m",
      propertyId: null,
      affectedCount: 1,
    }));
    expect(computeAuditScore(checks)).toBe(0);
  });
});

describe("checkMissingKeyExpenses", () => {
  it("flags key expenses present last year but missing this year", () => {
    const currentTotals = new Map([["insurance", 1200]]);
    const priorTotals = new Map([["insurance", 1100], ["council_rates", 2000]]);

    const results = checkMissingKeyExpenses("p1", "10 Main St", currentTotals, priorTotals);
    expect(results).toHaveLength(1);
    expect(results[0].checkType).toBe("missing_key_expense");
    expect(results[0].severity).toBe("warning");
    expect(results[0].message).toContain("Council Rates");
    expect(results[0].propertyId).toBe("p1");
  });

  it("returns empty when all prior-year key expenses are present", () => {
    const currentTotals = new Map([["insurance", 1200], ["council_rates", 2100]]);
    const priorTotals = new Map([["insurance", 1100], ["council_rates", 2000]]);

    const results = checkMissingKeyExpenses("p1", "10 Main St", currentTotals, priorTotals);
    expect(results).toHaveLength(0);
  });

  it("ignores key expenses not present in prior year either", () => {
    const currentTotals = new Map<string, number>();
    const priorTotals = new Map<string, number>();

    const results = checkMissingKeyExpenses("p1", "10 Main St", currentTotals, priorTotals);
    expect(results).toHaveLength(0);
  });
});

describe("checkUncategorizedTransactions", () => {
  it("flags uncategorized transactions assigned to a property", () => {
    const txns = [
      { category: "uncategorized", propertyId: "p1", amount: "100", isVerified: false },
      { category: "insurance", propertyId: "p1", amount: "200", isVerified: true },
      { category: "uncategorized", propertyId: "p1", amount: "300", isVerified: false },
    ];

    const results = checkUncategorizedTransactions("p1", "10 Main St", txns);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warning");
    expect(results[0].affectedCount).toBe(2);
  });

  it("returns empty when no uncategorized transactions", () => {
    const txns = [
      { category: "insurance", propertyId: "p1", amount: "200", isVerified: true },
    ];

    const results = checkUncategorizedTransactions("p1", "10 Main St", txns);
    expect(results).toHaveLength(0);
  });
});

describe("checkLoanInterestMissing", () => {
  it("flags property with loan but no interest recorded", () => {
    const hasLoan = true;
    const categoryTotals = new Map([["insurance", 1200]]);

    const results = checkLoanInterestMissing("p1", "10 Main St", hasLoan, categoryTotals);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warning");
    expect(results[0].checkType).toBe("loan_interest_missing");
  });

  it("returns empty when loan interest is recorded", () => {
    const hasLoan = true;
    const categoryTotals = new Map([["interest_on_loans", 5000]]);

    const results = checkLoanInterestMissing("p1", "10 Main St", hasLoan, categoryTotals);
    expect(results).toHaveLength(0);
  });

  it("returns empty when property has no loan", () => {
    const hasLoan = false;
    const categoryTotals = new Map<string, number>();

    const results = checkLoanInterestMissing("p1", "10 Main St", hasLoan, categoryTotals);
    expect(results).toHaveLength(0);
  });
});

describe("checkMissedDeductions", () => {
  it("suggests commonly missed deductions not claimed", () => {
    const portfolioCats = new Set(["insurance", "council_rates"]);

    const results = checkMissedDeductions(portfolioCats);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].severity).toBe("info");
    expect(results[0].checkType).toBe("missed_deduction");
  });

  it("returns empty when all common deductions are claimed", () => {
    const portfolioCats = new Set([
      "insurance", "council_rates", "pest_control", "gardening",
      "stationery_and_postage", "water_charges", "land_tax",
      "body_corporate", "repairs_and_maintenance",
    ]);

    const results = checkMissedDeductions(portfolioCats);
    expect(results).toHaveLength(0);
  });
});

describe("checkUnassignedTransactions", () => {
  it("flags expense transactions with no property", () => {
    const txns = [
      { category: "insurance", propertyId: null, amount: "-200", transactionType: "expense", isVerified: true },
      { category: "insurance", propertyId: "p1", amount: "-200", transactionType: "expense", isVerified: true },
      { category: "rental_income", propertyId: null, amount: "500", transactionType: "income", isVerified: true },
    ];

    const result = checkUnassignedTransactions(txns);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("info");
    expect(result[0].affectedCount).toBe(1);
  });

  it("returns empty when all expenses are assigned", () => {
    const txns = [
      { category: "insurance", propertyId: "p1", amount: "-200", transactionType: "expense", isVerified: true },
    ];

    const result = checkUnassignedTransactions(txns);
    expect(result).toHaveLength(0);
  });
});

describe("checkLargeUnverified", () => {
  it("flags unverified transactions over $1000", () => {
    const txns = [
      { category: "repairs_and_maintenance", propertyId: "p1", amount: "-1500", isVerified: false, description: "Plumbing" },
      { category: "insurance", propertyId: "p1", amount: "-500", isVerified: false, description: "Insurance" },
      { category: "land_tax", propertyId: "p1", amount: "-2000", isVerified: true, description: "Land tax" },
    ];

    const results = checkLargeUnverified("p1", "10 Main St", txns);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].affectedCount).toBe(1);
  });

  it("returns empty when all large transactions are verified", () => {
    const txns = [
      { category: "land_tax", propertyId: "p1", amount: "-2000", isVerified: true, description: "Land tax" },
    ];

    const results = checkLargeUnverified("p1", "10 Main St", txns);
    expect(results).toHaveLength(0);
  });
});

describe("checkNoRentalIncome", () => {
  it("flags properties with no rental income", () => {
    const incomeTotals = new Map<string, number>();

    const results = checkNoRentalIncome("p1", "10 Main St", incomeTotals);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warning");
  });

  it("returns empty when rental income exists", () => {
    const incomeTotals = new Map([["rental_income", 25000]]);

    const results = checkNoRentalIncome("p1", "10 Main St", incomeTotals);
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/__tests__/audit-checks.test.ts`
Expected: FAIL — module `../audit-checks` not found.

**Step 3: Write the service implementation**

Create `src/server/services/audit-checks.ts`:

```typescript
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { transactions, properties } from "@/server/db/schema";
import { categoryMap, categories } from "@/lib/categories";
import { getFinancialYearRange, getPropertiesWithLoans } from "./reports";

// --- Constants ---

const KEY_EXPENSES = [
  "land_tax",
  "council_rates",
  "water_charges",
  "repairs_and_maintenance",
  "insurance",
  "body_corporate",
] as const;

const COMMONLY_MISSED = [
  "pest_control",
  "gardening",
  "stationery_and_postage",
] as const;

const INCOME_CATEGORIES = new Set(["rental_income", "other_rental_income"]);

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 20,
  warning: 10,
  info: 5,
};

// --- Types ---

export interface AuditCheckResult {
  checkType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  propertyId: string | null;
  affectedCount: number;
}

export interface AuditPropertyScore {
  propertyId: string;
  address: string;
  score: number;
  checks: AuditCheckResult[];
  passedCount: number;
  totalChecks: number;
}

export interface AuditReport {
  year: number;
  yearLabel: string;
  portfolioScore: number;
  properties: AuditPropertyScore[];
  portfolioChecks: AuditCheckResult[];
  summary: { info: number; warning: number; critical: number };
}

// --- Pure functions (exported for testing) ---

export function computeAuditScore(checks: AuditCheckResult[]): number {
  let score = 100;
  for (const check of checks) {
    score -= SEVERITY_WEIGHTS[check.severity] ?? 0;
  }
  return Math.max(0, score);
}

export function checkMissingKeyExpenses(
  propertyId: string,
  address: string,
  currentTotals: Map<string, number>,
  priorTotals: Map<string, number>,
): AuditCheckResult[] {
  const results: AuditCheckResult[] = [];

  for (const key of KEY_EXPENSES) {
    const priorAmount = priorTotals.get(key) ?? 0;
    const currentAmount = currentTotals.get(key) ?? 0;

    if (priorAmount > 0 && currentAmount === 0) {
      const label = categoryMap.get(key)?.label ?? key;
      results.push({
        checkType: "missing_key_expense",
        severity: "warning",
        title: `Missing ${label}`,
        message: `${address}: ${label} was claimed last year but has no entries this year.`,
        propertyId,
        affectedCount: 1,
      });
    }
  }

  return results;
}

export function checkUncategorizedTransactions(
  propertyId: string,
  address: string,
  txns: Array<{ category: string; propertyId: string | null }>,
): AuditCheckResult[] {
  const uncategorized = txns.filter(
    (t) => t.category === "uncategorized" && t.propertyId === propertyId,
  );

  if (uncategorized.length === 0) return [];

  return [{
    checkType: "uncategorized_transactions",
    severity: "warning",
    title: "Uncategorized Transactions",
    message: `${address}: ${uncategorized.length} transaction(s) still uncategorized.`,
    propertyId,
    affectedCount: uncategorized.length,
  }];
}

export function checkLoanInterestMissing(
  propertyId: string,
  address: string,
  hasLoan: boolean,
  categoryTotals: Map<string, number>,
): AuditCheckResult[] {
  if (!hasLoan) return [];

  const interest = categoryTotals.get("interest_on_loans") ?? 0;
  if (interest > 0) return [];

  return [{
    checkType: "loan_interest_missing",
    severity: "warning",
    title: "Loan Interest Not Recorded",
    message: `${address}: Property has a loan but no interest expense recorded this year.`,
    propertyId,
    affectedCount: 1,
  }];
}

export function checkMissedDeductions(
  claimedCategories: Set<string>,
): AuditCheckResult[] {
  const results: AuditCheckResult[] = [];

  for (const cat of COMMONLY_MISSED) {
    if (!claimedCategories.has(cat)) {
      const label = categoryMap.get(cat)?.label ?? cat;
      results.push({
        checkType: "missed_deduction",
        severity: "info",
        title: `Consider ${label}`,
        message: `You haven't claimed ${label}. Many property investors claim this deduction.`,
        propertyId: null,
        affectedCount: 1,
      });
    }
  }

  return results;
}

export function checkUnassignedTransactions(
  txns: Array<{ propertyId: string | null; transactionType: string }>,
): AuditCheckResult[] {
  const unassigned = txns.filter(
    (t) => !t.propertyId && t.transactionType === "expense",
  );

  if (unassigned.length === 0) return [];

  return [{
    checkType: "unassigned_transactions",
    severity: "info",
    title: "Unassigned Expense Transactions",
    message: `${unassigned.length} expense transaction(s) not assigned to any property.`,
    propertyId: null,
    affectedCount: unassigned.length,
  }];
}

export function checkLargeUnverified(
  propertyId: string,
  address: string,
  txns: Array<{ propertyId: string | null; amount: string; isVerified: boolean }>,
): AuditCheckResult[] {
  const large = txns.filter(
    (t) =>
      t.propertyId === propertyId &&
      !t.isVerified &&
      Math.abs(Number(t.amount)) > 1000,
  );

  if (large.length === 0) return [];

  return [{
    checkType: "large_unverified",
    severity: "info",
    title: "Large Unverified Transactions",
    message: `${address}: ${large.length} transaction(s) over $1,000 not yet verified.`,
    propertyId,
    affectedCount: large.length,
  }];
}

export function checkNoRentalIncome(
  propertyId: string,
  address: string,
  incomeTotals: Map<string, number>,
): AuditCheckResult[] {
  let totalIncome = 0;
  for (const [cat, amount] of incomeTotals) {
    if (INCOME_CATEGORIES.has(cat)) {
      totalIncome += amount;
    }
  }

  if (totalIncome > 0) return [];

  return [{
    checkType: "no_rental_income",
    severity: "warning",
    title: "No Rental Income",
    message: `${address}: No rental income recorded this financial year.`,
    propertyId,
    affectedCount: 1,
  }];
}

// --- Helpers ---

function groupByPropertyAndCategory(
  txns: Array<{ propertyId: string | null; category: string; amount: string }>,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const t of txns) {
    if (!t.propertyId) continue;
    const amount = Math.abs(Number(t.amount));

    let propMap = result.get(t.propertyId);
    if (!propMap) {
      propMap = new Map();
      result.set(t.propertyId, propMap);
    }

    propMap.set(t.category, (propMap.get(t.category) ?? 0) + amount);
  }

  return result;
}

function groupByPropertyAllCategories(
  txns: Array<{ propertyId: string | null; category: string; amount: string }>,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const t of txns) {
    if (!t.propertyId) continue;
    const amount = Number(t.amount);

    let propMap = result.get(t.propertyId);
    if (!propMap) {
      propMap = new Map();
      result.set(t.propertyId, propMap);
    }

    propMap.set(t.category, (propMap.get(t.category) ?? 0) + amount);
  }

  return result;
}

// --- Main service function ---

export async function buildAuditReport(
  userId: string,
  year: number,
): Promise<AuditReport> {
  const currentRange = getFinancialYearRange(year);
  const priorRange = getFinancialYearRange(year - 1);

  const [userProperties, currentTxns, priorTxns] = await Promise.all([
    getPropertiesWithLoans(userId),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, currentRange.startDate),
        lte(transactions.date, currentRange.endDate),
      ),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, priorRange.startDate),
        lte(transactions.date, priorRange.endDate),
      ),
    }),
  ]);

  const txnArray = currentTxns as Array<{
    propertyId: string | null;
    category: string;
    amount: string;
    transactionType: string;
    isVerified: boolean;
    description: string;
  }>;
  const priorArray = priorTxns as Array<{
    propertyId: string | null;
    category: string;
    amount: string;
  }>;

  // Group by property
  const currentGrouped = groupByPropertyAndCategory(txnArray);
  const priorGrouped = groupByPropertyAndCategory(priorArray);
  const currentIncomeGrouped = groupByPropertyAllCategories(txnArray);

  // Portfolio-wide claimed categories
  const claimedCategories = new Set<string>();
  for (const propMap of currentGrouped.values()) {
    for (const cat of propMap.keys()) {
      claimedCategories.add(cat);
    }
  }

  // Portfolio-level checks
  const portfolioChecks: AuditCheckResult[] = [
    ...checkMissedDeductions(claimedCategories),
    ...checkUnassignedTransactions(txnArray),
  ];

  // Per-property checks
  const propertyScores: AuditPropertyScore[] = [];

  for (const prop of userProperties) {
    const propCurrentTotals = currentGrouped.get(prop.id) ?? new Map();
    const propPriorTotals = priorGrouped.get(prop.id) ?? new Map();
    const propIncomeTotals = currentIncomeGrouped.get(prop.id) ?? new Map();
    const hasLoan = (prop as { loans?: unknown[] }).loans?.length ? true : false;

    const checks: AuditCheckResult[] = [
      ...checkMissingKeyExpenses(prop.id, prop.address, propCurrentTotals, propPriorTotals),
      ...checkUncategorizedTransactions(prop.id, prop.address, txnArray),
      ...checkLoanInterestMissing(prop.id, prop.address, hasLoan, propCurrentTotals),
      ...checkLargeUnverified(prop.id, prop.address, txnArray),
      ...checkNoRentalIncome(prop.id, prop.address, propIncomeTotals),
    ];

    const totalChecks = 5; // 5 property-level check types
    const passedCount = totalChecks - checks.length;

    propertyScores.push({
      propertyId: prop.id,
      address: prop.address,
      score: computeAuditScore(checks),
      checks,
      passedCount: Math.max(0, passedCount),
      totalChecks,
    });
  }

  // Summary
  const allChecks = [...portfolioChecks, ...propertyScores.flatMap((p) => p.checks)];
  const summary = { info: 0, warning: 0, critical: 0 };
  for (const check of allChecks) {
    summary[check.severity]++;
  }

  // Portfolio score = average of property scores (or 100 if no properties)
  const portfolioScore =
    propertyScores.length > 0
      ? Math.round(
          propertyScores.reduce((sum, p) => sum + p.score, 0) / propertyScores.length,
        )
      : 100;

  return {
    year,
    yearLabel: currentRange.label,
    portfolioScore,
    properties: propertyScores,
    portfolioChecks,
    summary,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/services/__tests__/audit-checks.test.ts`
Expected: All 17 tests PASS.

**Step 5: Commit**

```bash
git add src/server/services/audit-checks.ts src/server/services/__tests__/audit-checks.test.ts
git commit -m "feat(audit): add audit checks service with TDD tests"
```

---

### Task 2: tRPC Router

**Files:**
- Create: `src/server/routers/auditChecks.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/auditChecks.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { buildAuditReport } from "../services/audit-checks";

export const auditChecksRouter = router({
  getReport: protectedProcedure
    .input(
      z.object({
        year: z.number().min(2020).max(2030),
      })
    )
    .query(async ({ ctx, input }) => {
      return buildAuditReport(ctx.portfolio.ownerId, input.year);
    }),
});
```

**Step 2: Register in `_app.ts`**

Add import after the `yoyComparisonRouter` import:

```typescript
import { auditChecksRouter } from "./auditChecks";
```

Add to the router object after `yoyComparison: yoyComparisonRouter,`:

```typescript
  auditChecks: auditChecksRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/auditChecks.ts src/server/routers/_app.ts
git commit -m "feat(audit): add audit checks tRPC router"
```

---

### Task 3: Score Badge Component

**Files:**
- Create: `src/components/reports/AuditScoreBadge.tsx`

**Step 1: Create the score badge component**

Create `src/components/reports/AuditScoreBadge.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

interface AuditScoreBadgeProps {
  score: number;
  size?: "sm" | "lg";
}

export function AuditScoreBadge({ score, size = "sm" }: AuditScoreBadgeProps) {
  const colorClass =
    score >= 80
      ? "bg-green-100 text-green-800 border-green-300"
      : score >= 50
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-red-100 text-red-800 border-red-300";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-bold",
        colorClass,
        size === "lg" ? "h-16 w-16 text-2xl" : "h-8 w-8 text-xs",
      )}
    >
      {score}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reports/AuditScoreBadge.tsx
git commit -m "feat(audit): add audit score badge component"
```

---

### Task 4: Audit Checks Content Component

**Files:**
- Create: `src/components/reports/AuditChecksContent.tsx`

**Step 1: Create the client component**

Create `src/components/reports/AuditChecksContent.tsx`:

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc/client";
import { AuditScoreBadge } from "./AuditScoreBadge";
import {
  ChevronDown,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Info,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <CircleAlert className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

export function AuditChecksContent() {
  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();
  const latestYear = availableYears?.[0]?.year;

  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const effectiveYear = selectedYear ?? latestYear;

  const { data, isLoading } = trpc.auditChecks.getReport.useQuery(
    { year: effectiveYear! },
    { enabled: !!effectiveYear },
  );

  if (!availableYears || availableYears.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Audit Checks</h2>
          <p className="text-muted-foreground">
            Automated checks for tax readiness and data quality
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No financial year data found. Start tracking transactions to run audit checks.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audit Checks</h2>
          <p className="text-muted-foreground">
            Automated checks for tax readiness and data quality
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Financial year:</span>
          <Select
            value={String(effectiveYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y.year} value={String(y.year)}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* Portfolio Score */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Portfolio Audit Score
                </CardTitle>
                <AuditScoreBadge score={data.portfolioScore} size="lg" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                {data.summary.critical > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <CircleAlert className="h-4 w-4" />
                    {data.summary.critical} critical
                  </span>
                )}
                {data.summary.warning > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    {data.summary.warning} warning{data.summary.warning !== 1 ? "s" : ""}
                  </span>
                )}
                {data.summary.info > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Info className="h-4 w-4" />
                    {data.summary.info} suggestion{data.summary.info !== 1 ? "s" : ""}
                  </span>
                )}
                {data.summary.critical === 0 && data.summary.warning === 0 && data.summary.info === 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    All checks passed
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Portfolio-wide Checks */}
          {data.portfolioChecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Portfolio-Wide Checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.portfolioChecks.map((check, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <SeverityIcon severity={check.severity} />
                    <div>
                      <p className="text-sm font-medium">{check.title}</p>
                      <p className="text-sm text-muted-foreground">{check.message}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Per-Property Checks */}
          {data.properties.map((prop) => (
            <Collapsible key={prop.propertyId}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AuditScoreBadge score={prop.score} />
                      <CardTitle className="text-base">{prop.address}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {prop.passedCount}/{prop.totalChecks} passed
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    {prop.checks.length === 0 ? (
                      <p className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        All checks passed for this property.
                      </p>
                    ) : (
                      prop.checks.map((check, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <SeverityIcon severity={check.severity} />
                          <div>
                            <p className="text-sm font-medium">{check.title}</p>
                            <p className="text-sm text-muted-foreground">{check.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reports/AuditChecksContent.tsx
git commit -m "feat(audit): add audit checks page content component"
```

---

### Task 5: Page Wrapper & Reports Hub Link

**Files:**
- Create: `src/app/(dashboard)/reports/audit-checks/page.tsx`
- Modify: `src/app/(dashboard)/reports/page.tsx`

**Step 1: Create the page wrapper**

Create `src/app/(dashboard)/reports/audit-checks/page.tsx`:

```typescript
import { Suspense } from "react";
import { AuditChecksContent } from "@/components/reports/AuditChecksContent";

export const dynamic = "force-dynamic";

function AuditChecksLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit Checks</h2>
        <p className="text-muted-foreground">
          Automated checks for tax readiness and data quality
        </p>
      </div>
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="h-48 bg-muted animate-pulse rounded-lg" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function AuditChecksPage() {
  return (
    <Suspense fallback={<AuditChecksLoading />}>
      <AuditChecksContent />
    </Suspense>
  );
}
```

**Step 2: Add the 8th card to the reports hub**

In `src/app/(dashboard)/reports/page.tsx`, add `ShieldCheck` to the Lucide import:

```typescript
import { FileText, PieChart, Download, TrendingUp, Calculator, ClipboardList, BarChart3, ShieldCheck } from "lucide-react";
```

Add a new entry at the end of the `reportTypes` array (after the Year-over-Year entry):

```typescript
  {
    title: "Audit Checks",
    description: "Automated tax readiness and data quality checks with per-property audit scores",
    icon: ShieldCheck,
    href: "/reports/audit-checks",
  },
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reports/audit-checks/page.tsx src/app/\(dashboard\)/reports/page.tsx
git commit -m "feat(audit): add report page and reports hub link"
```

---

### Task 6: Type Check and Final Verification

**Files:** None (verification only)

**Step 1: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass (including the 17 new audit-checks tests).

**Step 3: Run linter on changed files**

Run: `npx eslint src/server/services/audit-checks.ts src/server/routers/auditChecks.ts src/components/reports/AuditScoreBadge.tsx src/components/reports/AuditChecksContent.tsx src/app/\(dashboard\)/reports/audit-checks/page.tsx src/app/\(dashboard\)/reports/page.tsx`
Expected: No errors or warnings.

**Step 4: Fix any issues found in steps 1-3, then commit**

```bash
git add -A
git commit -m "fix(audit): resolve lint and type check issues"
```

(Skip this commit if steps 1-3 are clean.)
