# Property Performance Scorecard Design

**Date:** 2026-02-18
**Status:** Approved
**Feature:** #10 from roadmap (Wave B)

---

## Goal

New `/reports/scorecard` page that shows per-property performance metrics with color-coded comparison, reusing existing analytics infrastructure and adding 3 new computed metrics.

## Architecture

Single new tRPC procedure (`scorecard.getPropertyScorecard`) aggregates data from existing sources (performanceBenchmarking, rentalYield, portfolio repos) and computes 3 new metrics server-side. One new page component consumes it. No schema changes.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Location | New `/reports/scorecard` page | Keeps portfolio page focused on overview |
| Scoring | Reuse existing 0-100 performanceBenchmarking score | Avoid duplication; add new metrics as data columns |
| Plan gating | None explicit | Free plan caps at 1 property; comparison value is natural Pro upsell |
| Tax benefit | Simplified — annual deduction total | Skip marginal rate calc for v1 |

## 1. New tRPC Procedure

**Router:** `src/server/routers/analytics/scorecard.ts`
**Procedure:** `protectedProcedure` (read-only)

Computes per-property metrics in a single server call:

| Metric | Source | Calculation |
|--------|--------|-------------|
| Performance Score (0-100) | performanceBenchmarking | Existing weighted score (yield 40%, growth 30%, expenses 20%, vacancy 10%) |
| Score Label | performanceBenchmarking | "Excellent" / "Good" / "Average" / "Below Average" / "Poor" |
| Gross Yield | rentalYield | annualRent / propertyValue x 100 |
| Net Yield | rentalYield | (annualRent - expenses) / propertyValue x 100 |
| Capital Growth % | portfolio | (currentValue - purchasePrice) / purchasePrice x 100 |
| Annual Cash Flow | portfolio | annualIncome - annualExpenses |
| **Cap Rate** (new) | Computed | NOI / currentValue x 100 (NOI = rent - operating expenses, excludes mortgage) |
| **Cash-on-Cash Return** (new) | Computed | annualCashFlow / totalCashInvested x 100 (cash invested = deposit + stamp duty + costs from settlement) |
| **Annual Tax Deductions** (new) | Computed | Sum of deductible expense categories for the property in current FY |

### Return Shape

```typescript
{
  properties: Array<{
    propertyId: string;
    address: string;
    suburb: string;
    state: string;
    performanceScore: number | null;
    scoreLabel: string | null;
    grossYield: number;
    netYield: number;
    capRate: number;
    cashOnCash: number | null; // null if no settlement data
    capitalGrowthPercent: number;
    annualCashFlow: number;
    annualTaxDeductions: number;
    currentValue: number;
    equity: number;
  }>;
  portfolioAverages: {
    avgScore: number | null;
    avgGrossYield: number;
    avgNetYield: number;
    avgCapRate: number;
    avgCashFlow: number;
  };
  bestPerformer: { propertyId: string; address: string; score: number } | null;
  worstPerformer: { propertyId: string; address: string; score: number } | null;
}
```

## 2. Page Layout

### Top: Summary Cards (4 cards in responsive grid)

| Card | Content |
|------|---------|
| Portfolio Avg Score | 0-100 with color-coded badge |
| Best Performer | Property address + score |
| Worst Performer | Property address + score |
| Portfolio Avg Gross Yield | Percentage with trend context |

### Middle: Comparison Table

- One row per property
- Columns: Property | Score | Gross Yield | Net Yield | Cap Rate | Cash-on-Cash | Capital Growth | Cash Flow | Tax Deductions
- Color-coded cells relative to portfolio average
- Sortable by any column (click header)
- Default sort: performance score descending

### Bottom: Expandable Insights

- Click/expand a row to see detailed insights from `performanceBenchmarking.getPropertyPerformance`
- Shows: percentile bars for yield/growth/expenses/vacancy + actionable text insights
- Fetched on-demand (not preloaded for all properties)

## 3. Color-Coding

**Percentage metrics** (relative to portfolio average):
- Green: >= portfolio avg + 20%
- Amber: within 20% of portfolio avg
- Red: <= portfolio avg - 20%

**Performance score** (absolute thresholds):
- Green: >= 70
- Amber: 40-69
- Red: < 40

**Cash flow** (absolute):
- Green: positive
- Amber: $0 to -$100/month
- Red: < -$100/month

## 4. Sidebar Entry

Add "Scorecard" to "Reports & Tax" nav group with `TrendingUp` icon, after "Accountant Pack".

## 5. No Schema Changes

All data computed on-the-fly from existing tables: properties, property_values, transactions, loans, settlement costs.
