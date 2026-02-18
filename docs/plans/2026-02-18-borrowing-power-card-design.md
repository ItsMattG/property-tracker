# Borrowing Power Card — Design

> **Beads task:** property-tracker-6t6

**Goal:** Add a Borrowing Power card to the portfolio dashboard that estimates how much additional borrowing the user's investment portfolio can support, with an expandable scenario calculator to test a target property price.

**Architecture:** New `portfolio.getBorrowingPower` tRPC procedure aggregates existing loan, transaction, and property value data into borrowing metrics. A single client component renders the headline estimate, supporting ratios, and a collapsible scenario calculator (client-side math, no API call).

## Data Model

No schema changes. All inputs from existing tables:

| Source | Fields Used |
|--------|-------------|
| `loans` | `currentBalance`, `repaymentAmount`, `repaymentFrequency`, `interestRate`, `propertyId` |
| `property_values` | Latest `estimatedValue` per property (fallback to `purchasePrice`) |
| `transactions` (last 12mo) | Rental income, expenses (excluding capital categories) |

## Calculations

### Portfolio-level (server-side, tRPC procedure)

```
totalPortfolioValue = Sum(latest property values)
totalDebt = Sum(loan.currentBalance)
portfolioLVR = totalDebt / totalPortfolioValue

usableEquity = max(0, totalPortfolioValue × 0.80 - totalDebt)

annualRentalIncome = Sum(income transactions, last 12mo)
annualExpenses = Sum(expense transactions excl. capital, last 12mo)
annualRepayments = Sum(loan repayments, annualized from frequency)
  → weekly × 52, fortnightly × 26, monthly × 12, quarterly × 4

netSurplus = annualRentalIncome - annualExpenses - annualRepayments

debtServiceRatio = annualRepayments / annualRentalIncome
  → null if no rental income

weightedAvgRate = Sum(loan.currentBalance × loan.interestRate) / Sum(loan.currentBalance)

estimatedBorrowingPower = usableEquity if netSurplus > 0, else 0
```

### Scenario calculator (client-side)

User inputs a target property price. Client computes:

```
newLoan = targetPrice × 0.80
depositNeeded = targetPrice × 0.20
assessmentRate = weightedAvgRate + 3% (APRA-style buffer)
newAnnualRepayment = newLoan × assessmentRate
surplusAfter = netSurplus - newAnnualRepayment

equityCheck = depositNeeded <= usableEquity
serviceabilityCheck = surplusAfter > 0
```

Result states:
- Both pass → "Looks feasible"
- Equity short → "Equity short by $X"
- Serviceability short → "Serviceability short by $X/yr"
- Both short → show both

## Return Type

```typescript
interface BorrowingPowerResult {
  totalPortfolioValue: number;
  totalDebt: number;
  portfolioLVR: number;
  usableEquity: number;
  annualRentalIncome: number;
  annualExpenses: number;
  annualRepayments: number;
  netSurplus: number;
  debtServiceRatio: number | null;
  estimatedBorrowingPower: number;
  weightedAvgRate: number;
  hasLoans: boolean;
}
```

## Card Layout

Placed alongside the LVR gauge card in the existing 2-col row on the dashboard.

```
┌─────────────────────────────────────────────┐
│ Borrowing Power                             │
│                                             │
│  Estimated Additional Borrowing             │
│  $125,000            ← headline, color-coded│
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Usable   │ │ Net      │ │ Debt     │    │
│  │ Equity   │ │ Surplus  │ │ Service  │    │
│  │ $125,000 │ │ $8,200/yr│ │ 42%      │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                             │
│  ▶ Explore a scenario                       │
│  ┌─────────────────────────────────────┐    │
│  │ Target property price               │    │
│  │ [$850,000_____]                     │    │
│  │                                     │    │
│  │ Deposit needed:  $170,000  ✗        │    │
│  │ New repayment:   $3,200/mo          │    │
│  │ Surplus after:   -$1,400/yr ✗       │    │
│  │                                     │    │
│  │ ⚠ Equity short by $45,000          │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Estimate only — consult your broker        │
└─────────────────────────────────────────────┘
```

### Color Thresholds

| Metric | Green | Amber | Red |
|--------|-------|-------|-----|
| Headline (usable equity) | > $50k | $1–$50k | $0 |
| Net surplus | Positive | — | Negative or zero |
| DSR | < 40% | 40–60% | > 60% |

### Empty State (no loans)

Card renders with icon + "Add your loans to see borrowing power" + button linking to property loans page.

## Component Architecture

**New procedure:** `portfolio.getBorrowingPower` in `src/server/routers/portfolio/portfolio.ts`

**New component:** `src/components/dashboard/BorrowingPowerCard.tsx`
- `"use client"` component
- `trpc.portfolio.getBorrowingPower.useQuery()` with 60s staleTime
- Scenario calculator: `useState` for target price, `useMemo` for derived results
- No new dependencies

**Dashboard integration:** Add to `DashboardClient.tsx` in the LVR gauge row.

## Files

| Action | Path |
|--------|------|
| Create | `src/components/dashboard/BorrowingPowerCard.tsx` |
| Create | `src/server/routers/portfolio/__tests__/borrowingPower.test.ts` |
| Modify | `src/server/routers/portfolio/portfolio.ts` |
| Modify | `src/components/dashboard/DashboardClient.tsx` |

## Testing

Unit tests on the tRPC procedure (9 cases):
1. Empty portfolio → zeros, `hasLoans: false`
2. Properties with no loans → usableEquity = value × 0.80, hasLoans false
3. Correct annualization (weekly, fortnightly, monthly)
4. Weighted average rate across multiple loans
5. Net surplus positive → estimatedBorrowingPower = usableEquity
6. Net surplus negative → estimatedBorrowingPower = 0
7. DSR null when no rental income
8. Usable equity capped at 0 when LVR > 80%
9. Capital category expenses excluded from annualExpenses

No E2E tests — read-only card, unit tests cover the logic.

## Disclaimer

Every render of the card includes: "Estimate only — does not include personal income, living expenses, or lender-specific criteria. Consult your mortgage broker."
