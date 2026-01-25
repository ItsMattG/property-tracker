# Loan Comparison & Refinancing Alerts Design

## Goal

Build a loan comparison system that monitors existing loans against estimated market rates, alerts users to refinancing opportunities, and provides comprehensive comparison calculators.

## Architecture

```
RBA Cash Rate API → rate-data service → estimated market rates
                                      ↓
User's loans (existing) → comparison engine → rate gap detection
                                            ↓
                          Alert triggers → notifications (existing system)
                                            ↓
                          Comparison UI → savings/break-even/amortization
```

**Key Components:**
1. **Rate Data Service** - Fetches RBA cash rate, estimates lender margins based on loan type
2. **Comparison Engine** - Compares user's actual rate vs estimated market rate
3. **Alert Service** - Triggers notifications on rate gaps and RBA changes
4. **Comparison Calculator** - Shows savings, break-even, and amortization schedules
5. **Cron Jobs** - Daily RBA rate check + weekly comparison scan

## Database Schema

### rateHistory
Stores RBA cash rate history, updated by cron job.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| rateDate | date | Date rate became effective |
| cashRate | decimal(5,2) | e.g., 4.35 |
| createdAt | timestamp | Record creation time |

### loanComparisons
User's saved comparison scenarios.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| userId | string | FK to users |
| loanId | uuid | FK to loans |
| name | string | e.g., "CBA vs Athena" |
| newRate | decimal(5,3) | Rate being compared against |
| newLender | string | Optional lender name |
| switchingCosts | integer | Refinancing costs in cents |
| createdAt | timestamp | Record creation time |

### refinanceAlerts
Per-loan alert configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| loanId | uuid | FK to loans |
| enabled | boolean | Alert enabled flag |
| rateGapThreshold | decimal(3,2) | e.g., 0.50 for 0.5% |
| notifyOnCashRateChange | boolean | Notify on RBA changes |
| lastAlertedAt | timestamp | Prevent alert spam |
| createdAt | timestamp | Record creation time |

## Estimated Market Rate Logic

Calculate on-the-fly rather than storing:
1. Fetch current RBA cash rate from `rateHistory`
2. Add margin based on loan type and LVR band
3. Compare against user's actual rate

### Margin Table

| Loan Type | LVR ≤80% | LVR >80% |
|-----------|----------|----------|
| Owner P&I | +2.00% | +2.30% |
| Owner IO | +2.40% | +2.70% |
| Investor P&I | +2.30% | +2.60% |
| Investor IO | +2.60% | +2.90% |

## Service Layer

### rate-data.ts
- `fetchRbaCashRate()` - Calls RBA statistics API
- `getLatestCashRate()` - Returns most recent rate from `rateHistory`
- `getEstimatedMarketRate(loanType, lvrBand)` - Cash rate + margin lookup

### loan-comparison.ts
- `calculateMonthlySavings(currentRate, newRate, principal, remainingMonths)`
- `calculateTotalInterestSaved(currentRate, newRate, principal, remainingMonths)`
- `calculateBreakEven(monthlySavings, switchingCosts)` - Returns months
- `generateAmortizationSchedule(principal, rate, termMonths)` - Returns array

### refinance-alert.ts
- `checkRateGaps(userId)` - Compare all user loans against market
- `processRbaCashRateChange(oldRate, newRate)` - Notify subscribed users

## Cron Jobs

### /api/cron/rba-rate-check (Daily)
1. Fetch RBA cash rate from API
2. Compare against latest stored rate
3. If changed, store new rate and trigger `processRbaCashRateChange`

### /api/cron/refinance-scan (Weekly)
1. Get all loans with `refinanceAlerts.enabled = true`
2. For each, calculate rate gap vs estimated market
3. If gap exceeds threshold and not recently alerted, send notification

## UI Pages

### /loans/[id]/compare
Comparison calculator for a specific loan:
- Current loan details (rate, balance, remaining term)
- Estimated market rate indicator
- New rate input field
- Switching costs input
- Results: monthly savings, total interest saved, break-even months
- Expandable amortization schedule comparison
- Save comparison button

### /loans/compare
Overview of saved comparisons:
- List of saved comparison scenarios
- Summary cards showing potential savings
- Link to alert configuration

### /settings/refinance-alerts
Alert configuration:
- Per-loan refinance monitoring toggle
- Rate gap threshold slider (0.25% - 1.0%)
- Cash rate change notification toggle
- Test alert button

## Components

| Component | Purpose |
|-----------|---------|
| ComparisonCalculator.tsx | Main calculator with inputs and results |
| SavingsSummary.tsx | Monthly/total savings display |
| BreakEvenChart.tsx | Visual break-even timeline |
| AmortizationTable.tsx | Side-by-side schedule comparison |
| MarketRateIndicator.tsx | Shows estimated vs current rate |
| RefinanceAlertConfig.tsx | Per-loan alert settings |

## Notifications

### New Notification Types
- `refinance_opportunity` - Rate gap exceeds threshold
- `cash_rate_changed` - RBA rate moved

### Email Templates
- `refinance-opportunity.ts` - Savings opportunity alert
- `cash-rate-changed.ts` - RBA rate change impact

## Error Handling

| Scenario | Handling |
|----------|----------|
| RBA API unavailable | Log error, skip update, retry next run |
| Invalid loan data | Skip loan in scan, don't alert |
| Calculation edge cases | Return null, UI shows "N/A" |

## RBA API

- Endpoint: `https://api.rba.gov.au/statistics/tables/f1/data.json`
- Free, public, no authentication required
- Returns historical cash rate data as JSON

## Testing

- Unit tests for calculation functions (savings, break-even, amortization)
- Unit tests for margin lookup table
- Integration tests for RBA rate fetch (mock API)
- E2E test for comparison calculator flow
