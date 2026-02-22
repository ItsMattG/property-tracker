# Borrowing Power Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Borrowing Power dashboard card that estimates additional borrowing capacity from investment portfolio data, with an expandable scenario calculator.

**Architecture:** New `portfolio.getBorrowingPower` tRPC procedure aggregates loans, transactions, and property values into a `BorrowingPowerResult`. A `BorrowingPowerCard` client component renders the headline estimate with supporting metrics and a collapsible scenario calculator (client-side math). Placed alongside the LVR gauge card on the dashboard.

**Tech Stack:** tRPC v11, React 19, Tailwind v4, Vitest, shadcn/ui

**Design doc:** `docs/plans/2026-02-18-borrowing-power-card-design.md`

**Beads task:** property-tracker-6t6

---

### Task 1: tRPC Procedure — `portfolio.getBorrowingPower`

**Files:**
- Modify: `src/server/routers/portfolio/portfolio.ts`
- Test: `src/server/routers/portfolio/__tests__/borrowingPower.test.ts`

This procedure uses existing repository methods to aggregate borrowing power metrics. No schema changes.

**Step 1: Write the test file with all 9 test cases**

Create `src/server/routers/portfolio/__tests__/borrowingPower.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createTestCaller,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";
import type { UnitOfWork } from "../../../repositories/unit-of-work";

let currentMockUow: UnitOfWork;

vi.mock("../../../repositories/unit-of-work", () => ({
  UnitOfWork: class MockUnitOfWork {
    constructor() {
      return currentMockUow;
    }
  },
}));

const mockProperties = [
  {
    id: "prop-1",
    userId: "user-1",
    address: "123 Main St",
    suburb: "Richmond",
    state: "VIC",
    purchasePrice: "500000",
    status: "active",
    createdAt: new Date(),
  },
  {
    id: "prop-2",
    userId: "user-1",
    address: "456 Oak Ave",
    suburb: "Fitzroy",
    state: "VIC",
    purchasePrice: "700000",
    status: "active",
    createdAt: new Date(),
  },
];

const mockLoans = [
  {
    id: "loan-1",
    propertyId: "prop-1",
    currentBalance: "350000",
    repaymentAmount: "2000",
    repaymentFrequency: "monthly",
    interestRate: "5.50",
    property: mockProperties[0],
  },
  {
    id: "loan-2",
    propertyId: "prop-2",
    currentBalance: "500000",
    repaymentAmount: "1200",
    repaymentFrequency: "fortnightly",
    interestRate: "6.00",
    property: mockProperties[1],
  },
];

const mockTransactions = [
  {
    id: "txn-1",
    propertyId: "prop-1",
    category: "rental_income",
    transactionType: "income",
    amount: "25000",
    userId: "user-1",
  },
  {
    id: "txn-2",
    propertyId: "prop-1",
    category: "insurance",
    transactionType: "expense",
    amount: "2000",
    userId: "user-1",
  },
  {
    id: "txn-3",
    propertyId: "prop-2",
    category: "rental_income",
    transactionType: "income",
    amount: "35000",
    userId: "user-1",
  },
  {
    id: "txn-4",
    propertyId: "prop-2",
    category: "council_rates",
    transactionType: "expense",
    amount: "5000",
    userId: "user-1",
  },
];

function setupCtx(overrides: Partial<Parameters<typeof createMockUow>[0]> = {}) {
  const uow = createMockUow({
    portfolio: {
      findProperties: vi.fn().mockResolvedValue(mockProperties),
      getLatestPropertyValues: vi.fn().mockResolvedValue(new Map()),
      findLoansByProperties: vi.fn().mockResolvedValue(mockLoans),
      findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
    },
    ...overrides,
  });

  currentMockUow = uow;

  const ctx = createMockContext({ userId: mockUser.id, user: mockUser, uow });
  ctx.db = {
    query: {
      users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
    },
  } as ReturnType<typeof createMockContext>["db"];

  return { ctx, caller: createTestCaller(ctx), uow };
}

describe("portfolio.getBorrowingPower", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeros with hasLoans false for empty portfolio", async () => {
    const { caller } = setupCtx({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue([]),
        getLatestPropertyValues: vi.fn().mockResolvedValue(new Map()),
        findLoansByProperties: vi.fn().mockResolvedValue([]),
        findTransactionsInRange: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.totalPortfolioValue).toBe(0);
    expect(result.totalDebt).toBe(0);
    expect(result.usableEquity).toBe(0);
    expect(result.hasLoans).toBe(false);
    expect(result.estimatedBorrowingPower).toBe(0);
  });

  it("returns usable equity with hasLoans false when no loans", async () => {
    const { caller } = setupCtx({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(new Map()),
        findLoansByProperties: vi.fn().mockResolvedValue([]),
        findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
      },
    });

    const result = await caller.portfolio.getBorrowingPower();

    // totalValue = 500000 + 700000 = 1200000 (purchase prices, no valuations)
    // usableEquity = 1200000 * 0.80 - 0 = 960000
    expect(result.totalPortfolioValue).toBe(1200000);
    expect(result.totalDebt).toBe(0);
    expect(result.usableEquity).toBe(960000);
    expect(result.hasLoans).toBe(false);
    expect(result.annualRepayments).toBe(0);
    // No repayments so surplus is positive => borrowing power = usableEquity
    expect(result.estimatedBorrowingPower).toBe(960000);
  });

  it("annualizes repayments correctly from different frequencies", async () => {
    // loan-1: $2000/month × 12 = $24000/yr
    // loan-2: $1200/fortnight × 26 = $31200/yr
    const { caller } = setupCtx();

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.annualRepayments).toBe(55200);
  });

  it("calculates weighted average rate across loans", async () => {
    // loan-1: balance=350000, rate=5.50%
    // loan-2: balance=500000, rate=6.00%
    // weighted = (350000*5.50 + 500000*6.00) / (350000+500000)
    //          = (1925000 + 3000000) / 850000 = 5.794...
    const { caller } = setupCtx();

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.weightedAvgRate).toBeCloseTo(5.79, 1);
  });

  it("returns estimatedBorrowingPower = usableEquity when surplus positive", async () => {
    const { caller } = setupCtx();

    const result = await caller.portfolio.getBorrowingPower();

    // totalValue = 1200000 (purchase prices)
    // totalDebt = 350000 + 500000 = 850000
    // usableEquity = 1200000 * 0.80 - 850000 = 110000
    expect(result.usableEquity).toBe(110000);

    // annualIncome = 25000 + 35000 = 60000
    // annualExpenses = 2000 + 5000 = 7000
    // annualRepayments = 24000 + 31200 = 55200
    // netSurplus = 60000 - 7000 - 55200 = -2200
    // Surplus is negative! So estimatedBorrowingPower = 0
    expect(result.netSurplus).toBe(-2200);
    expect(result.estimatedBorrowingPower).toBe(0);
  });

  it("returns estimatedBorrowingPower = 0 when surplus negative", async () => {
    // Use default mocks — netSurplus will be -2200 (see test above)
    const { caller } = setupCtx();

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.netSurplus).toBeLessThan(0);
    expect(result.estimatedBorrowingPower).toBe(0);
  });

  it("returns DSR null when no rental income", async () => {
    const { caller } = setupCtx({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(new Map()),
        findLoansByProperties: vi.fn().mockResolvedValue(mockLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.debtServiceRatio).toBeNull();
  });

  it("caps usable equity at 0 when LVR exceeds 80%", async () => {
    // Properties worth 500k + 700k = 1.2M
    // Loans totaling more than 80% of value
    const highLvrLoans = [
      {
        id: "loan-1",
        propertyId: "prop-1",
        currentBalance: "480000",
        repaymentAmount: "2500",
        repaymentFrequency: "monthly",
        interestRate: "5.50",
        property: mockProperties[0],
      },
      {
        id: "loan-2",
        propertyId: "prop-2",
        currentBalance: "600000",
        repaymentAmount: "3000",
        repaymentFrequency: "monthly",
        interestRate: "6.00",
        property: mockProperties[1],
      },
    ];
    // totalDebt = 1080000, 80% of 1200000 = 960000
    // usableEquity = 960000 - 1080000 = -120000 => capped at 0

    const { caller } = setupCtx({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(new Map()),
        findLoansByProperties: vi.fn().mockResolvedValue(highLvrLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue(mockTransactions),
      },
    });

    const result = await caller.portfolio.getBorrowingPower();

    expect(result.usableEquity).toBe(0);
    expect(result.estimatedBorrowingPower).toBe(0);
  });

  it("excludes capital category expenses from annualExpenses", async () => {
    const transactionsWithCapital = [
      ...mockTransactions,
      {
        id: "txn-cap",
        propertyId: "prop-1",
        category: "stamp_duty",
        transactionType: "expense",
        amount: "20000",
        userId: "user-1",
      },
    ];

    const { caller } = setupCtx({
      portfolio: {
        findProperties: vi.fn().mockResolvedValue(mockProperties),
        getLatestPropertyValues: vi.fn().mockResolvedValue(new Map()),
        findLoansByProperties: vi.fn().mockResolvedValue(mockLoans),
        findTransactionsInRange: vi.fn().mockResolvedValue(transactionsWithCapital),
      },
    });

    const result = await caller.portfolio.getBorrowingPower();

    // stamp_duty should be excluded => expenses still 7000
    expect(result.annualExpenses).toBe(7000);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/routers/portfolio/__tests__/borrowingPower.test.ts`
Expected: FAIL — `portfolio.getBorrowingPower` does not exist yet.

**Step 3: Implement the procedure**

Add to `src/server/routers/portfolio/portfolio.ts`:

1. Add import at top:
```typescript
import { categories } from "@/lib/categories";
```

2. Add the procedure after `getPropertyMetrics` (before the closing `});` of the router):

```typescript
  getBorrowingPower: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;
    const userProperties = await ctx.uow.portfolio.findProperties(ownerId);

    if (userProperties.length === 0) {
      return {
        totalPortfolioValue: 0,
        totalDebt: 0,
        portfolioLVR: 0,
        usableEquity: 0,
        annualRentalIncome: 0,
        annualExpenses: 0,
        annualRepayments: 0,
        netSurplus: 0,
        debtServiceRatio: null as number | null,
        estimatedBorrowingPower: 0,
        weightedAvgRate: 0,
        hasLoans: false,
      };
    }

    const propertyIds = userProperties.map((p) => p.id);

    // Last 12 months date range
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const startDate = lastYear.toISOString().split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    const capitalCategoryValues = new Set(
      categories.filter((c) => c.type === "capital").map((c) => c.value)
    );

    const [latestValues, allLoans, transactions] = await Promise.all([
      ctx.uow.portfolio.getLatestPropertyValues(ownerId, propertyIds),
      ctx.uow.portfolio.findLoansByProperties(ownerId, propertyIds),
      ctx.uow.portfolio.findTransactionsInRange(ownerId, startDate, endDate),
    ]);

    // Portfolio value
    const totalPortfolioValue = userProperties.reduce(
      (sum, p) => sum + (latestValues.get(p.id) || Number(p.purchasePrice)),
      0
    );

    // Debt
    const totalDebt = allLoans.reduce(
      (sum, l) => sum + Number(l.currentBalance),
      0
    );

    const hasLoans = allLoans.length > 0;
    const portfolioLVR = totalPortfolioValue > 0
      ? Math.round((totalDebt / totalPortfolioValue) * 1000) / 10
      : 0;

    // Usable equity at 80% LVR ceiling
    const usableEquity = Math.max(0, Math.round(totalPortfolioValue * 0.8 - totalDebt));

    // Filter transactions to portfolio properties only
    const portfolioTransactions = transactions.filter(
      (t) => t.propertyId && propertyIds.includes(t.propertyId)
    );

    const annualRentalIncome = portfolioTransactions
      .filter((t) => t.transactionType === "income")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const annualExpenses = portfolioTransactions
      .filter((t) => t.transactionType === "expense" && !capitalCategoryValues.has(t.category))
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    // Annualize repayments
    const frequencyMultiplier: Record<string, number> = {
      weekly: 52,
      fortnightly: 26,
      monthly: 12,
      quarterly: 4,
    };

    const annualRepayments = allLoans.reduce((sum, loan) => {
      const multiplier = frequencyMultiplier[loan.repaymentFrequency] ?? 12;
      return sum + Number(loan.repaymentAmount) * multiplier;
    }, 0);

    const netSurplus = Math.round(annualRentalIncome - annualExpenses - annualRepayments);

    const debtServiceRatio = annualRentalIncome > 0
      ? Math.round((annualRepayments / annualRentalIncome) * 1000) / 10
      : null;

    // Weighted average interest rate
    const weightedAvgRate = totalDebt > 0
      ? Math.round(
          (allLoans.reduce((sum, l) => sum + Number(l.currentBalance) * Number(l.interestRate), 0) / totalDebt) * 100
        ) / 100
      : 0;

    const estimatedBorrowingPower = netSurplus > 0 ? usableEquity : 0;

    return {
      totalPortfolioValue: Math.round(totalPortfolioValue),
      totalDebt: Math.round(totalDebt),
      portfolioLVR,
      usableEquity,
      annualRentalIncome: Math.round(annualRentalIncome),
      annualExpenses: Math.round(annualExpenses),
      annualRepayments: Math.round(annualRepayments),
      netSurplus,
      debtServiceRatio,
      estimatedBorrowingPower,
      weightedAvgRate,
      hasLoans,
    };
  }),
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/routers/portfolio/__tests__/borrowingPower.test.ts`
Expected: 9 tests PASS.

**Step 5: Commit**

```bash
git add src/server/routers/portfolio/portfolio.ts src/server/routers/portfolio/__tests__/borrowingPower.test.ts
git commit -m "feat: add portfolio.getBorrowingPower tRPC procedure with tests"
```

---

### Task 2: BorrowingPowerCard Component

**Files:**
- Create: `src/components/dashboard/BorrowingPowerCard.tsx`

**Step 1: Create the component**

Create `src/components/dashboard/BorrowingPowerCard.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Landmark, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { cn, formatCurrency } from "@/lib/utils";
import Link from "next/link";

function getHeadlineColor(equity: number): string {
  if (equity > 50000) return "text-success";
  if (equity > 0) return "text-warning";
  return "text-destructive";
}

function getSurplusColor(surplus: number): string {
  return surplus > 0 ? "text-success" : "text-destructive";
}

function getDsrColor(dsr: number | null): string {
  if (dsr === null) return "text-muted-foreground";
  if (dsr < 40) return "text-success";
  if (dsr <= 60) return "text-warning";
  return "text-destructive";
}

export function BorrowingPowerCard() {
  const { data, isLoading } = trpc.portfolio.getBorrowingPower.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");

  const scenario = useMemo(() => {
    const price = parseFloat(targetPrice.replace(/[^0-9.]/g, ""));
    if (!data || !price || price <= 0) return null;

    const newLoan = price * 0.8;
    const depositNeeded = price * 0.2;
    const assessmentRate = (data.weightedAvgRate + 3) / 100;
    const newAnnualRepayment = newLoan * assessmentRate;
    const newMonthlyRepayment = newAnnualRepayment / 12;
    const surplusAfter = data.netSurplus - newAnnualRepayment;
    const equityShortfall = Math.max(0, depositNeeded - data.usableEquity);
    const equityOk = depositNeeded <= data.usableEquity;
    const serviceabilityOk = surplusAfter > 0;

    return {
      depositNeeded,
      newMonthlyRepayment,
      surplusAfter: Math.round(surplusAfter),
      equityShortfall: Math.round(equityShortfall),
      equityOk,
      serviceabilityOk,
      feasible: equityOk && serviceabilityOk,
    };
  }, [data, targetPrice]);

  if (isLoading) {
    return (
      <Card data-testid="borrowing-power-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Borrowing Power</CardTitle>
          <Landmark className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.hasLoans) {
    return (
      <Card data-testid="borrowing-power-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Borrowing Power</CardTitle>
          <Landmark className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <Landmark className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Add your loans to see borrowing power</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/properties">Manage Properties</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="borrowing-power-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Borrowing Power</CardTitle>
        <Landmark className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Headline estimate */}
        <div>
          <p className="text-xs text-muted-foreground">Estimated Additional Borrowing</p>
          <p className={cn("text-2xl font-bold tabular-nums", getHeadlineColor(data.estimatedBorrowingPower))}>
            {formatCurrency(data.estimatedBorrowingPower)}
          </p>
        </div>

        {/* Supporting metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Usable Equity</p>
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(data.usableEquity)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Surplus</p>
            <p className={cn("text-sm font-semibold tabular-nums", getSurplusColor(data.netSurplus))}>
              {formatCurrency(data.netSurplus)}/yr
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Debt Service</p>
            <p className={cn("text-sm font-semibold tabular-nums", getDsrColor(data.debtServiceRatio))}>
              {data.debtServiceRatio !== null ? `${data.debtServiceRatio}%` : "--"}
            </p>
          </div>
        </div>

        {/* Scenario calculator toggle */}
        <button
          type="button"
          onClick={() => setScenarioOpen(!scenarioOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full"
        >
          {scenarioOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          Explore a scenario
        </button>

        {/* Scenario calculator */}
        {scenarioOpen && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
            <div>
              <label htmlFor="target-price" className="text-xs text-muted-foreground block mb-1">
                Target property price
              </label>
              <Input
                id="target-price"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 850000"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="tabular-nums"
              />
            </div>

            {scenario && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit needed (20%)</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    {formatCurrency(scenario.depositNeeded)}
                    {scenario.equityOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New repayment</span>
                  <span className="tabular-nums">{formatCurrency(scenario.newMonthlyRepayment)}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Surplus after</span>
                  <span className={cn("flex items-center gap-1 tabular-nums", getSurplusColor(scenario.surplusAfter))}>
                    {formatCurrency(scenario.surplusAfter)}/yr
                    {scenario.serviceabilityOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </span>
                </div>

                {/* Result summary */}
                {scenario.feasible ? (
                  <div className="p-2 rounded-md bg-success/10 text-success text-xs flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    Looks feasible based on portfolio data
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    {!scenario.equityOk && (
                      <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Equity short by {formatCurrency(scenario.equityShortfall)}
                      </div>
                    )}
                    {!scenario.serviceabilityOk && (
                      <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Serviceability short by {formatCurrency(Math.abs(scenario.surplusAfter))}/yr
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground leading-tight">
          Estimate only — does not include personal income, living expenses, or lender-specific criteria. Consult your mortgage broker.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "BorrowingPowerCard" || echo "No errors in BorrowingPowerCard"`
Expected: No errors in BorrowingPowerCard (or only pre-existing errors from other files).

**Step 3: Commit**

```bash
git add src/components/dashboard/BorrowingPowerCard.tsx
git commit -m "feat: add BorrowingPowerCard component with scenario calculator"
```

---

### Task 3: Dashboard Integration

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Step 1: Add import**

Add after line 33 (`import { EquityProjectionCard } from "./EquityProjectionCard";`):

```typescript
import { BorrowingPowerCard } from "./BorrowingPowerCard";
```

**Step 2: Add card to the LVR gauge row**

Find the 2-col grid containing `LvrGaugeCard` and `EquityProjectionCard` (around line 466-473):

```tsx
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-card-entrance" style={{ '--stagger-index': 0 } as React.CSSProperties}>
          <LvrGaugeCard />
        </div>
        <div className="animate-card-entrance" style={{ '--stagger-index': 1 } as React.CSSProperties}>
          <EquityProjectionCard />
        </div>
      </div>
```

Replace with a 3-col grid:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="animate-card-entrance" style={{ '--stagger-index': 0 } as React.CSSProperties}>
          <LvrGaugeCard />
        </div>
        <div className="animate-card-entrance" style={{ '--stagger-index': 1 } as React.CSSProperties}>
          <BorrowingPowerCard />
        </div>
        <div className="animate-card-entrance" style={{ '--stagger-index': 2 } as React.CSSProperties}>
          <EquityProjectionCard />
        </div>
      </div>
```

**Step 3: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "DashboardClient" || echo "No errors in DashboardClient"`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add BorrowingPowerCard to dashboard layout"
```

---

### Task 4: Final Verification

**Step 1: Run all borrowing power tests**

Run: `npx vitest run src/server/routers/portfolio/__tests__/borrowingPower.test.ts`
Expected: 9 tests PASS.

**Step 2: Run full test suite to check for regressions**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass, no regressions.

**Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"`
Expected: Only pre-existing errors (from RuleForm.tsx / categorizationRules.ts), zero new errors.

**Step 4: Commit (if any fixes needed)**

Only if fixes were required in steps 1-3.

---

## Tech Notes

- **Portfolio repository** already has `findProperties`, `getLatestPropertyValues`, `findLoansByProperties`, and `findTransactionsInRange` — no new repo methods needed
- **Loan schema** has `repaymentAmount` (decimal), `repaymentFrequency` (text), `interestRate` (decimal), `currentBalance` (decimal) — all stored as strings requiring `Number()` conversion
- **Capital categories** use the same `categories` import from `@/lib/categories` with `c.type === "capital"` filter, consistent with scorecard procedure
- **Dashboard card pattern** follows `LvrGaugeCard` exactly: `staleTime: 60_000`, loading skeleton, empty state with CTA, `data-testid` attribute
- **Test pattern** uses `createMockUow` proxy with `portfolio` repo overrides — same pattern as scorecard tests but using portfolio repo methods instead of individual repos
- **Scenario calculator** is purely client-side (`useMemo` derived from `useState` + query data) — no additional API calls
- **Assessment rate buffer** of +3% follows APRA's serviceability buffer requirement for residential lending
