# Cash Flow Forecasting Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

12-month cash flow projections with configurable scenarios. Users can model different assumptions (rent growth, expense inflation, interest rate changes, vacancy) and compare outcomes side-by-side.

---

## Data Model

```sql
forecast_scenarios
- id (uuid, pk)
- userId (uuid, fk → users)
- name (text) - "Base Case", "Rate Rise 1%", "High Vacancy"
- assumptions (jsonb):
  - rentGrowthPercent (default 2%)
  - expenseInflationPercent (default 3%)
  - vacancyRatePercent (default 0%)
  - interestRateChangePercent (default 0%)
- isDefault (boolean) - one default per user
- createdAt, updatedAt

cash_flow_forecasts
- id (uuid, pk)
- userId (uuid, fk → users)
- scenarioId (uuid, fk → forecast_scenarios)
- propertyId (uuid, nullable) - null = portfolio-wide
- forecastMonth (date) - first of month
- projectedIncome (decimal)
- projectedExpenses (decimal)
- projectedNet (decimal)
- breakdown (jsonb) - { rent: 2400, rates: -150, insurance: -100, ... }
- createdAt
```

**Key decisions:**
- Scenarios are user-configurable with sensible defaults
- Forecasts are stored per-month for fast retrieval
- Breakdown stores category-level detail for drill-down
- Portfolio-wide forecasts have propertyId = null

---

## Forecast Calculation Logic

### Baseline Calculation (per property, per month)

**Income:**
1. Get expected rent from recurring transactions with `transactionType = 'income'`
2. Apply `rentGrowthPercent` compounding monthly: `rent * (1 + rate/12)^month`
3. Apply `vacancyRatePercent` reduction

**Expenses:**
1. Get expected expenses from recurring transactions
2. Apply `expenseInflationPercent` compounding monthly
3. For loan interest: recalculate based on `interestRateChangePercent`

**Net:** `projectedIncome - projectedExpenses`

### Loan Interest Adjustment

```
currentRate = loan.interestRate
adjustedRate = currentRate + scenario.interestRateChangePercent
monthlyInterest = loanBalance * (adjustedRate / 100 / 12)
```

### When Forecasts Are Generated

- On scenario create/update (regenerate that scenario's 12 months)
- On recurring transaction create/update/delete (regenerate affected months)
- Daily cron job to roll forward (add new month, remove old)

---

## Service Layer

### Forecast Service (`/src/server/services/forecast.ts`)

```typescript
// Core generation
generateForecast(userId, scenarioId, propertyId?, months: 12) → void
recalculateForProperty(userId, propertyId) → void
rollForwardForecasts() → void

// Helpers
applyGrowthRate(baseAmount, monthsAhead, annualRate) → number
calculateLoanInterest(loan, rateAdjustment) → number
```

### Forecast Router (`/src/server/routers/forecast.ts`)

```typescript
// Scenarios
listScenarios        // User's scenarios
createScenario       // Create + generate forecasts
updateScenario       // Update + regenerate forecasts
deleteScenario       // Delete scenario + its forecasts
setDefaultScenario   // Mark as default

// Forecasts
getForecast          // 12-month forecast for scenario + optional property
getComparison        // Compare 2-3 scenarios side-by-side
getSummary           // Annual totals: income, expenses, net, cash-on-cash
```

---

## UI Design

### Page: `/reports/forecast`

**Header Section:**
- Title: "Cash Flow Forecast"
- Scenario selector dropdown (shows default, can switch)
- Property filter (All Properties / specific property)
- "Manage Scenarios" button → opens modal

**Chart Section:**
- Line chart showing 12 months of projected cash flow
- Lines for: Income (green), Expenses (red), Net (blue)
- X-axis: months (Jan 2026 → Dec 2026)
- Hover shows breakdown tooltip
- Negative months highlighted with warning background

**Summary Cards:**
- Projected Annual Income
- Projected Annual Expenses
- Projected Net Position (green/red based on +/-)
- Cash-on-Cash Return (net / equity)

**Comparison Mode:**
- Toggle "Compare Scenarios"
- Select 2-3 scenarios to overlay on chart
- Summary cards show side-by-side comparison

**Scenario Management Modal:**
- List of scenarios with edit/delete
- Create new scenario form with assumption sliders
- Duplicate scenario button

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `/src/server/db/schema.ts` | Add tables |
| `/src/server/services/forecast.ts` | Generation logic |
| `/src/server/routers/forecast.ts` | tRPC endpoints |
| `/src/app/api/cron/forecast-rollover/route.ts` | Daily cron |
| `/src/app/(dashboard)/reports/forecast/page.tsx` | Forecast page |
| `/src/components/forecast/ForecastChart.tsx` | Line chart |
| `/src/components/forecast/ScenarioSelector.tsx` | Dropdown |
| `/src/components/forecast/ScenarioModal.tsx` | Create/edit modal |
| `/src/components/forecast/ForecastSummary.tsx` | Summary cards |
| `/src/components/forecast/ComparisonView.tsx` | Multi-scenario view |

### Modified Files

| File | Change |
|------|--------|
| `/src/server/routers/_app.ts` | Register forecast router |
| `/src/server/routers/recurring.ts` | Trigger recalculation |
| `/src/components/layout/Sidebar.tsx` | Add Forecast link |

---

## No External Dependencies

- Uses existing Recharts library for charts
- All calculation runs locally against existing data
