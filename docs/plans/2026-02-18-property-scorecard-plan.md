# Property Performance Scorecard Enhancement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the existing scorecard page with 3 new metrics (cap rate, cash-on-cash return, annual tax deductions), capital growth %, equity, color-coded cells, and best/worst performer summary cards.

**Architecture:** Extend the existing `getPortfolioScorecard` procedure in `performanceBenchmarking.ts` to compute additional metrics from loans and transaction data. Update the `PropertyScorecardEntry` type. Enhance the existing `ScorecardComparison` and `PropertyScorecard` components with new columns and color-coding. No new routers, pages, or schema changes.

**Tech Stack:** tRPC v11, Drizzle ORM, React 19, Tailwind v4, Zod v4

---

## Context: What Already Exists

The scorecard is already partially built:

- **Page:** `src/app/(dashboard)/analytics/scorecard/page.tsx` — 3-state pattern with summary cards + comparison + per-property cards
- **Router:** `performanceBenchmarking.getPortfolioScorecard` in `src/server/routers/analytics/performanceBenchmarking.ts:292-411`
- **Components:**
  - `src/components/analytics/ScorecardComparison.tsx` — side-by-side comparison table (7 metrics, best-value highlighting)
  - `src/components/analytics/PropertyScorecard.tsx` — per-property card (score badge, yields, cash flow, percentile bars)
  - `src/components/analytics/ScoreIndicator.tsx` — percentile bar component
- **Types:** `src/types/performance-benchmarking.ts` — `PropertyScorecardEntry`, `PortfolioScorecardSummary`
- **Sidebar:** Already has entry at `/analytics/scorecard` with `Award` icon
- **Existing metrics:** performanceScore, scoreLabel, grossYield, netYield, annualCashFlow, annualRent, annualExpenses, purchasePrice, currentValue, yieldPercentile, expensePercentile, isUnderperforming

## What's Missing (This Plan Adds)

| Metric | Calculation | Data Source |
|--------|-------------|-------------|
| **Cap Rate** | (annualRent - operatingExpenses) / currentValue × 100. Operating expenses = all expenses EXCEPT `interest_on_loans`. | Transactions (already fetched) |
| **Cash-on-Cash Return** | annualCashFlow / totalCashInvested × 100. Cash invested = purchasePrice + sum of capital category transactions (stamp_duty, conveyancing, buyers_agent_fees, initial_repairs). | Transactions + properties |
| **Annual Tax Deductions** | Sum of transactions where `isDeductible === true` for the property in last 12 months. | Transactions (already fetched) + `categories.ts` |
| **Capital Growth %** | (currentValue - purchasePrice) / purchasePrice × 100 | Properties + valuations (already fetched) |
| **Equity** | currentValue - totalLoans | Loans (new fetch needed) |
| **Best/Worst Performer** | Highest/lowest performanceScore entries | Computed from entries |
| **Color-coded cells** | Green/amber/red based on thresholds | Client-side logic |

---

### Task 1: Extend Types and Router — Add New Metrics

**Files:**
- Modify: `src/types/performance-benchmarking.ts`
- Modify: `src/server/routers/analytics/performanceBenchmarking.ts:292-411`
- Test: `src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts`

**Step 1: Update `PropertyScorecardEntry` type**

Add these fields to `PropertyScorecardEntry` in `src/types/performance-benchmarking.ts`:

```typescript
export interface PropertyScorecardEntry {
  // ... existing fields ...
  capRate: number;
  cashOnCash: number | null; // null if no capital cost transactions
  annualTaxDeductions: number;
  capitalGrowthPercent: number;
  equity: number;
}
```

Add these fields to `PortfolioScorecardSummary`:

```typescript
export interface PortfolioScorecardSummary {
  // ... existing fields ...
  bestPerformer: { propertyId: string; address: string; score: number } | null;
  worstPerformer: { propertyId: string; address: string; score: number } | null;
}
```

**Step 2: Write failing tests**

Add tests to `src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts`:

```typescript
describe("getPortfolioScorecard", () => {
  it("includes capRate in scorecard entries", () => {
    // capRate = (annualRent - operatingExpenses) / currentValue * 100
    // operatingExpenses = all expenses except interest_on_loans
  });

  it("includes cashOnCash as null when no capital transactions", () => {
    // cashOnCash should be null when no stamp_duty/conveyancing/buyers_agent_fees/initial_repairs
  });

  it("includes annualTaxDeductions from deductible categories", () => {
    // Sum of transactions with isDeductible === true
  });

  it("includes capitalGrowthPercent", () => {
    // (currentValue - purchasePrice) / purchasePrice * 100
  });

  it("includes bestPerformer and worstPerformer", () => {
    // Highest and lowest performanceScore
  });
});
```

Run: `cd ~/worktrees/property-tracker/scorecard && npx vitest run src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts --reporter=verbose`
Expected: Tests FAIL (new fields not computed yet)

**Step 3: Update `getPortfolioScorecard` procedure**

In `src/server/routers/analytics/performanceBenchmarking.ts`, modify the `getPortfolioScorecard` procedure:

1. Import `categories` from `@/lib/categories` at top of file:
```typescript
import { categories } from "@/lib/categories";
```

2. Add loan data fetch in the `Promise.all` block (line ~314):
```typescript
const [benchmarks, allTransactions, loansByProperty, ...recentValueLists] = await Promise.all([
  ctx.uow.similarProperties.findPerformanceBenchmarksByProperties(propertyIds),
  ctx.uow.transactions.findAllByOwner(ownerId, {
    startDate: lastYear.toISOString().split("T")[0],
  }),
  // Fetch all loans for the user's properties
  ctx.uow.loan.findByOwner(ownerId),
  ...userProperties.map((p) => ctx.uow.propertyValue.findRecent(p.id, 1)),
]);
```

3. Build a loan balance map:
```typescript
const loanMap = new Map<string, number>();
for (const loan of loansByProperty) {
  if (loan.propertyId) {
    const current = loanMap.get(loan.propertyId) ?? 0;
    loanMap.set(loan.propertyId, current + parseFloat(loan.currentBalance ?? "0"));
  }
}
```

4. Also fetch ALL transactions (not just last year) for capital costs (for cash-on-cash):
```typescript
const allTimeTransactions = await ctx.uow.transactions.findAllByOwner(ownerId);
```

Note: Actually, to avoid a second full transaction fetch, we should include capital transactions in the existing query. Capital transactions (stamp_duty, conveyancing, etc.) may have dates outside the last year window. Add a separate parallel query for capital costs:

```typescript
// In the Promise.all block, add:
ctx.uow.transactions.findAllByOwner(ownerId, {
  categories: ["stamp_duty", "conveyancing", "buyers_agent_fees", "initial_repairs"],
}),
```

If `findAllByOwner` doesn't support category filtering, fetch all and filter in JS. Check the repository interface.

5. Compute new metrics per property inside the `userProperties.map()`:
```typescript
// Deductible categories set (from categories.ts)
const deductibleCategories = new Set(
  categories.filter((c) => c.isDeductible).map((c) => c.value)
);

// Capital cost categories
const capitalCategories = new Set(["stamp_duty", "conveyancing", "buyers_agent_fees", "initial_repairs"]);

// Inside the map:
const operatingExpenses = propTransactions
  .filter((t) => t.transactionType === "expense" && t.category !== "interest_on_loans")
  .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

const noi = annualRent - operatingExpenses;
const capRate = currentValue > 0 ? (noi / currentValue) * 100 : 0;

// Capital costs from all-time transactions
const capitalCosts = allCapitalTransactions
  .filter((t) => t.propertyId === property.id && capitalCategories.has(t.category ?? ""))
  .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

const totalCashInvested = purchasePrice + capitalCosts;
const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : null;

const annualTaxDeductions = propTransactions
  .filter((t) => deductibleCategories.has(t.category ?? ""))
  .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

const capitalGrowthPercent = purchasePrice > 0
  ? ((currentValue - purchasePrice) / purchasePrice) * 100
  : 0;

const totalLoans = loanMap.get(property.id) ?? 0;
const equity = currentValue - totalLoans;
```

6. Add the new fields to the return object in the entry:
```typescript
return {
  // ... existing fields ...
  capRate: Math.round(capRate * 10) / 10,
  cashOnCash: cashOnCash !== null ? Math.round(cashOnCash * 10) / 10 : null,
  annualTaxDeductions: Math.round(annualTaxDeductions),
  capitalGrowthPercent: Math.round(capitalGrowthPercent * 10) / 10,
  equity: Math.round(equity),
};
```

7. Add best/worst performer to the return:
```typescript
const sortedByScore = [...entries].sort((a, b) => b.performanceScore - a.performanceScore);

return {
  // ... existing fields ...
  bestPerformer: sortedByScore.length > 0
    ? { propertyId: sortedByScore[0].propertyId, address: sortedByScore[0].address, score: sortedByScore[0].performanceScore }
    : null,
  worstPerformer: sortedByScore.length > 0
    ? { propertyId: sortedByScore[sortedByScore.length - 1].propertyId, address: sortedByScore[sortedByScore.length - 1].address, score: sortedByScore[sortedByScore.length - 1].performanceScore }
    : null,
};
```

**Step 4: Run tests**

Run: `cd ~/worktrees/property-tracker/scorecard && npx vitest run src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts --reporter=verbose`
Expected: All tests PASS

**Step 5: Type-check**

Run: `cd ~/worktrees/property-tracker/scorecard && npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors in page/components (expected — they need updating in Task 2)

**Step 6: Commit**

```bash
git add src/types/performance-benchmarking.ts src/server/routers/analytics/performanceBenchmarking.ts src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts
git commit -m "feat: add cap rate, cash-on-cash, tax deductions, equity to scorecard procedure"
```

---

### Task 2: Update ScorecardComparison Component — New Metric Rows + Color-Coding

**Files:**
- Modify: `src/components/analytics/ScorecardComparison.tsx`

**Step 1: Add color-coding utility**

Add a helper function at the top of the file:

```typescript
function getMetricColor(
  value: number,
  average: number,
  higherIsBetter: boolean
): "text-success" | "text-warning" | "text-destructive" {
  const threshold = Math.abs(average) * 0.2;
  if (higherIsBetter) {
    if (value >= average + threshold) return "text-success";
    if (value <= average - threshold) return "text-destructive";
    return "text-warning";
  }
  if (value <= average - threshold) return "text-success";
  if (value >= average + threshold) return "text-destructive";
  return "text-warning";
}
```

**Step 2: Add new metrics to the `metrics` array**

Add these entries to the `metrics` array in `ScorecardComparison.tsx`:

```typescript
{
  label: "Cap Rate",
  getValue: (e) => `${e.capRate}%`,
  getNumericValue: (e) => e.capRate,
  higherIsBetter: true,
  averageValue: /* compute from selectedProperties */,
},
{
  label: "Cash-on-Cash",
  getValue: (e) => e.cashOnCash !== null ? `${e.cashOnCash}%` : "N/A",
  getNumericValue: (e) => e.cashOnCash ?? 0,
  higherIsBetter: true,
  averageValue: /* compute from selectedProperties */,
},
{
  label: "Capital Growth",
  getValue: (e) => `${e.capitalGrowthPercent}%`,
  getNumericValue: (e) => e.capitalGrowthPercent,
  higherIsBetter: true,
  averageValue: /* compute from selectedProperties */,
},
{
  label: "Equity",
  getValue: (e) => formatCurrency(e.equity),
  getNumericValue: (e) => e.equity,
  higherIsBetter: true,
  averageValue: /* compute from selectedProperties */,
},
{
  label: "Tax Deductions",
  getValue: (e) => formatCurrency(e.annualTaxDeductions),
  getNumericValue: (e) => e.annualTaxDeductions,
  higherIsBetter: true,
  averageValue: /* compute from selectedProperties */,
},
```

**Step 3: Apply color-coding to table cells**

In the `<tbody>` rendering, update each cell to use `getMetricColor`:

```tsx
<td
  key={p.propertyId}
  className={cn(
    "text-right py-2.5 px-2 tabular-nums",
    isBest && "font-bold",
    getMetricColor(numVal, parseFloat(metric.averageValue.replace(/[^0-9.-]/g, "")), metric.higherIsBetter)
  )}
>
```

Note: The color function needs numeric averages. Add `getAverageNumeric` to `MetricRow` interface or compute from `averageValue`.

**Step 4: Type-check**

Run: `cd ~/worktrees/property-tracker/scorecard && npx tsc --noEmit 2>&1 | head -20`
Expected: May still have errors in page.tsx (Task 3 addresses those)

**Step 5: Commit**

```bash
git add src/components/analytics/ScorecardComparison.tsx
git commit -m "feat: add new metrics and color-coding to scorecard comparison table"
```

---

### Task 3: Update PropertyScorecard Component — Show New Metrics

**Files:**
- Modify: `src/components/analytics/PropertyScorecard.tsx`

**Step 1: Add new metrics to the grid**

Add cap rate, capital growth, equity, and tax deductions to the existing 2-column metrics grid:

```tsx
<div className="grid grid-cols-2 gap-3">
  {/* existing: Current Value, Purchase Price, Annual Rent, Annual Expenses */}
  <div>
    <p className="text-xs text-muted-foreground">Cap Rate</p>
    <p className="text-sm font-semibold">{entry.capRate}%</p>
  </div>
  <div>
    <p className="text-xs text-muted-foreground">Capital Growth</p>
    <p className={cn("text-sm font-semibold", entry.capitalGrowthPercent >= 0 ? "text-success" : "text-destructive")}>
      {entry.capitalGrowthPercent > 0 ? "+" : ""}{entry.capitalGrowthPercent}%
    </p>
  </div>
  <div>
    <p className="text-xs text-muted-foreground">Equity</p>
    <p className="text-sm font-semibold">{formatCurrency(entry.equity)}</p>
  </div>
  <div>
    <p className="text-xs text-muted-foreground">Tax Deductions</p>
    <p className="text-sm font-semibold">{formatCurrency(entry.annualTaxDeductions)}</p>
  </div>
  {entry.cashOnCash !== null && (
    <div>
      <p className="text-xs text-muted-foreground">Cash-on-Cash</p>
      <p className="text-sm font-semibold">{entry.cashOnCash}%</p>
    </div>
  )}
</div>
```

**Step 2: Commit**

```bash
git add src/components/analytics/PropertyScorecard.tsx
git commit -m "feat: display new metrics in property scorecard cards"
```

---

### Task 4: Update Scorecard Page — Best/Worst Performer Cards

**Files:**
- Modify: `src/app/(dashboard)/analytics/scorecard/page.tsx`

**Step 1: Update summary cards**

Replace the current 4 summary cards with: Portfolio Avg Score, Best Performer, Worst Performer, Avg Gross Yield. The "Underperforming" count can move to a smaller indicator.

```tsx
{/* Summary stats */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">Portfolio Score</p>
      <p className={cn(
        "text-2xl font-bold",
        scorecard.averageScore >= 70 ? "text-success" :
        scorecard.averageScore >= 40 ? "text-warning" : "text-destructive"
      )}>
        {scorecard.averageScore}
      </p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-1">
        <Trophy className="w-4 h-4 text-success" />
        <p className="text-sm text-muted-foreground">Best Performer</p>
      </div>
      {scorecard.bestPerformer ? (
        <>
          <p className="text-sm font-bold truncate">{scorecard.bestPerformer.address}</p>
          <p className="text-xs text-muted-foreground">Score: {scorecard.bestPerformer.score}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">--</p>
      )}
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-1">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <p className="text-sm text-muted-foreground">Needs Attention</p>
      </div>
      {scorecard.worstPerformer ? (
        <>
          <p className="text-sm font-bold truncate">{scorecard.worstPerformer.address}</p>
          <p className="text-xs text-muted-foreground">Score: {scorecard.worstPerformer.score}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">--</p>
      )}
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">Avg Gross Yield</p>
      <p className="text-2xl font-bold">{scorecard.averageGrossYield}%</p>
    </CardContent>
  </Card>
</div>
```

Add `Trophy` to the lucide-react import at the top.

**Step 2: Type-check entire project**

Run: `cd ~/worktrees/property-tracker/scorecard && npx tsc --noEmit`
Expected: PASS (all types aligned)

**Step 3: Commit**

```bash
git add src/app/(dashboard)/analytics/scorecard/page.tsx
git commit -m "feat: add best/worst performer cards and color-coded score to scorecard page"
```

---

### Task 5: Tests and Final Verification

**Files:**
- Test: `src/server/routers/analytics/__tests__/performanceBenchmarking.test.ts`

**Step 1: Run all tests**

Run: `cd ~/worktrees/property-tracker/scorecard && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

**Step 2: Type-check**

Run: `cd ~/worktrees/property-tracker/scorecard && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit if any fixes were needed**

```bash
git add -A && git commit -m "test: fix scorecard test assertions after enhancement"
```

---

## Tech Notes

**Existing infrastructure leveraged:**
- `performanceBenchmarking.getPortfolioScorecard` already fetches properties, transactions (last 12mo), valuations, and benchmarks in parallel
- `categories.ts` exports `isDeductible` flag per category — used for tax deductions sum
- Capital cost transactions (stamp_duty, conveyancing, etc.) are created by the settlement router and stored in `transactions` table
- Loan data via `ctx.uow.loan.findByOwner()` returns loans with `propertyId` and `currentBalance`

**Key formulas:**
- **Cap Rate:** NOI / Current Value × 100 (NOI = rent - operating expenses, excludes loan interest)
- **Cash-on-Cash:** Annual Cash Flow / Total Cash Invested × 100 (includes purchase price + capital costs)
- **Tax Deductions:** Sum of `|amount|` for transactions with `isDeductible === true` categories

**Color thresholds (client-side):**
- Green: >= portfolio avg + 20% (or >= 70 for score, positive for cash flow)
- Amber: within 20% of portfolio avg (or 40-69 for score)
- Red: <= portfolio avg - 20% (or < 40 for score, < -$100/mo for cash flow)
