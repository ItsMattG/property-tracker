# Forecasted vs Actual Tax - Design

**Date:** 2026-01-28
**Status:** Final
**Phase:** 8.1

## Overview

Add full-year tax forecasting as inline annotations alongside actual figures on the `/reports/tax-position` page, plus a one-line forecast summary on the dashboard card. No toggle or mode switching -- actuals are always shown, with forecast annotations alongside each line item.

## Forecast Calculation

### Algorithm

For each property + category combination:

1. Get actual monthly totals for months elapsed in current FY
2. Get prior FY's monthly totals for the remaining months
3. Forecasted annual total = sum of actuals + sum of prior year fill-in months
4. If no prior year data for remaining months → annualize: (YTD actual / months elapsed) × 12

### Edge Cases

- **Property added mid-year, no prior year**: annualize from acquisition date only
- **Single annual payment** (e.g., insurance in March): prior year pattern handles this -- it knows which month had the payment
- **No transactions yet**: forecast is null, no annotations shown for that property

### Confidence Indicator

- **High**: 9+ months of actuals, or full prior year data available
- **Medium**: 4-8 months of actuals with partial prior year
- **Low**: <4 months of actuals and no prior year data

## Backend

### New Files

- `src/server/services/tax-forecast.ts` -- forecast calculation logic
- `src/server/routers/taxForecast.ts` -- tRPC router

### Service Interface

```typescript
getForecast(userId, financialYear) → {
  properties: [{
    propertyId, address,
    categories: [{
      category, atoCode,
      actual: number,      // YTD actual
      forecast: number,    // projected full year
      confidence: "high" | "medium" | "low"
    }],
    totalIncome: { actual, forecast },
    totalDeductions: { actual, forecast },
    netResult: { actual, forecast }
  }],
  taxPosition: {
    actual: TaxPosition,
    forecast: TaxPosition
  }
}
```

### Router

One procedure: `getForecast(financialYear)` returning the full response.

### Reused Infrastructure

- `calculateTaxPosition()` from `tax-position.ts` for tax calc on forecast numbers
- Existing transaction queries filtered by FY
- Tax profile (salary, PAYG, etc.) is the same for both actual and forecast -- only rental result changes

### No Schema Changes

Forecast is computed on the fly from existing transactions and tax profiles. No new tables.

### Performance

Queries two FYs of transactions instead of one. Incremental cost is one additional FY query. Transactions are indexed by userId + date.

## Frontend

### Tax Position Page

Each line item gets an inline forecast annotation:

```
Interest on Loans    $12,400  → $24,200 projected
Council Rates        $1,800   → $3,600 projected
Insurance            $0       → $2,100 projected (based on prior year)
```

Arrow and projected figure in muted style (gray, smaller font). If actual equals forecast (category complete for the year), no annotation shown.

### Page Summary (top of tax position page)

```
Tax Position FY2025-26

Refund: $3,200 actual  →  $5,800 projected
         ▬▬▬▬▬▬▬▬░░░░  (8 of 12 months)

Confidence: High ●
```

Progress bar showing months elapsed. Confidence badge with high/medium/low.

### Dashboard Card

Add one line below existing refund/owing figure:

```
Refund: $3,200
Projected: $5,800 full year
```

New line in muted style. No other card changes.

### New Components

- `ForecastAnnotation` -- inline `→ $X projected` next to any amount
- `ForecastSummary` -- top-of-page summary with progress bar and confidence badge
- `ConfidenceBadge` -- small pill showing high/medium/low (green/amber/gray)
