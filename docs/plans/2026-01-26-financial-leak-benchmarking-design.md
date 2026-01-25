# Financial Leak Benchmarking Design

**Date:** 2026-01-26
**Status:** Approved

## Overview

Compare user's property expenses against state/industry averages to identify potential savings. Helps answer: "Am I overpaying for insurance/rates/management?"

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data Source | Static benchmarks | No API costs, simple MVP, can upgrade to crowdsourced later |
| Categories | Insurance, Council Rates, Management Fees | Most impactful and actionable |
| Display | Property card + Dashboard widget | Mirrors climate risk pattern, shows savings where relevant |
| Threshold | 15% above average | Avoids false positives from minor variations |
| Storage | None (calculated on-the-fly) | Uses existing transaction data, always fresh |

## Benchmark Data

### Insurance (Annual premium per $100k property value)

| State | Low | Average | High |
|-------|-----|---------|------|
| NSW | $140 | $180 | $220 |
| VIC | $130 | $165 | $200 |
| QLD | $160 | $200 | $250 |
| SA | $120 | $155 | $190 |
| WA | $130 | $170 | $210 |
| TAS | $110 | $145 | $180 |
| NT | $180 | $230 | $290 |
| ACT | $120 | $155 | $190 |

### Council Rates (Annual, median by state)

| State | Low | Average | High |
|-------|-----|---------|------|
| NSW | $1,200 | $1,800 | $2,500 |
| VIC | $1,400 | $2,100 | $2,800 |
| QLD | $1,300 | $1,900 | $2,600 |
| SA | $1,100 | $1,600 | $2,200 |
| WA | $1,200 | $1,750 | $2,400 |
| TAS | $1,000 | $1,500 | $2,000 |
| NT | $1,300 | $1,850 | $2,500 |
| ACT | $1,500 | $2,200 | $3,000 |

### Property Management Fees (% of annual rent)

| Level | Percentage |
|-------|------------|
| Low | 5.0% |
| Average | 7.0% |
| High | 8.8% |

## Calculation Logic

### Insurance Comparison

```typescript
userAnnualInsurance = sum of "insurance" transactions (last 12 months)
propertyValue = property.currentValue or purchasePrice
expectedInsurance = (propertyValue / 100000) * stateBenchmark.average
status = userAnnualInsurance > expectedInsurance * 1.15 ? "above" : "average"
potentialSavings = max(0, userAnnualInsurance - expectedInsurance)
```

### Council Rates Comparison

```typescript
userAnnualRates = sum of "council_rates" transactions (last 12 months)
expectedRates = stateBenchmark.average
status = userAnnualRates > expectedRates * 1.15 ? "above" : "average"
potentialSavings = max(0, userAnnualRates - expectedRates)
```

### Management Fees Comparison

```typescript
userAnnualFees = sum of "property_agent_fees" transactions (last 12 months)
annualRent = sum of "rental_income" transactions (last 12 months)
userFeePercent = (userAnnualFees / annualRent) * 100
expectedFees = annualRent * 0.07
status = userFeePercent > 8.0 ? "above" : "average"
potentialSavings = max(0, userAnnualFees - expectedFees)
```

## API Design

### Router: `benchmarkingRouter`

| Procedure | Input | Output |
|-----------|-------|--------|
| `getPropertyBenchmark` | `{ propertyId }` | `{ insurance, councilRates, managementFees, totalSavings }` |
| `getPortfolioSummary` | none | `{ totalSavings, byCategory, propertiesWithSavings }` |

### Response Shape

```typescript
interface CategoryBenchmark {
  userAmount: number;
  averageAmount: number;
  status: "below" | "average" | "above";
  potentialSavings: number;
  percentAbove: number; // e.g., 28 means 28% above average
}

interface PropertyBenchmark {
  insurance: CategoryBenchmark | null;
  councilRates: CategoryBenchmark | null;
  managementFees: CategoryBenchmark & { userPercent: number; averagePercent: number } | null;
  totalPotentialSavings: number;
}
```

## UI Components

### BenchmarkCard (Property Detail Page)

- Shows each category with user's cost vs average
- Status indicators: Below (green), Average (neutral), Above (amber)
- "Save ~$X" shown only when above average
- Total potential savings at bottom

### SavingsWidget (Dashboard)

- Only shown if total potential savings > $100
- Shows aggregate savings amount
- Breakdown by category
- Count of properties with savings opportunities

## Edge Cases

| Case | Handling |
|------|----------|
| No transactions for category | Don't show that category (return null) |
| < 12 months of data | Annualize from available data |
| No rental income (for mgmt fees) | Skip management fee comparison |
| Property without value | Use purchase price for insurance calc |

## Out of Scope

- Water charges benchmarking (usage-dependent)
- Land tax benchmarking (complex land value rules)
- Suburb-level granularity (state-level sufficient for MVP)
- Savings recommendations/links to providers
- Historical trend analysis
