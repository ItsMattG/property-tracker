# Scenario Simulator Design

**Date:** 2026-01-25
**Status:** Approved
**Phase:** Post-v0.2 (Tier 1)

## Goal

Build a comprehensive projection engine that lets property investors model financial what-ifs, buy/sell decisions, and stress test scenarios with composable factors, branching scenarios, and tax-aware CGT calculations.

## Architecture

The Scenario Simulator takes current portfolio state, applies user-defined modifications (factors), and calculates future outcomes across time.

**Core concepts:**

- **Factor** - A single change to model: rate increase, vacancy period, property sale, expense adjustment
- **Scenario** - A collection of factors applied together, optionally branching from another scenario
- **Projection** - The calculated outcome: monthly cash flows, equity positions, tax liabilities over a time horizon
- **Snapshot** - Frozen copy of portfolio data at save time, enabling "prediction vs reality" comparisons

**Data flow:**

```
Current Portfolio State (properties, loans, transactions, valuations)
         ↓
    Apply Factors (rate +2%, sell Property A, 3mo vacancy on B)
         ↓
    Projection Engine (monthly calculations for N years)
         ↓
    Results (cash flow timeline, metrics, CGT, recommendations)
         ↓
    Optional: Save with Snapshot
```

**Where it lives:**
- New route: `/reports/scenarios`
- Scenario list, create/edit forms, results view
- Integrates with existing tax reports (for CGT cost base data) and forecasting (shares projection logic)

---

## Data Model

```sql
-- Saved scenarios
scenarios
  - id UUID PRIMARY KEY
  - userId UUID NOT NULL
  - name TEXT NOT NULL
  - description TEXT
  - parentScenarioId UUID (for branching, nullable)
  - timeHorizonMonths INTEGER DEFAULT 60 (5 years)
  - status ('draft' | 'saved')
  - createdAt, updatedAt

-- Factors applied in a scenario
scenarioFactors
  - id UUID PRIMARY KEY
  - scenarioId UUID NOT NULL
  - factorType ('interest_rate' | 'vacancy' | 'sell_property' | 'buy_property' |
                'rent_change' | 'expense_change' | 'capital_event')
  - config JSONB NOT NULL  -- type-specific params
  - propertyId UUID (nullable, for property-specific factors)
  - startMonth INTEGER (when factor kicks in, 0 = immediate)
  - durationMonths INTEGER (nullable, for temporary factors like vacancy)
  - createdAt

-- Cached projection results (avoid recalculating)
scenarioProjections
  - id UUID PRIMARY KEY
  - scenarioId UUID NOT NULL
  - calculatedAt TIMESTAMP
  - timeHorizonMonths INTEGER
  - monthlyResults JSONB  -- array of monthly snapshots
  - summaryMetrics JSONB  -- net yield, total equity, CGT, etc.
  - isStale BOOLEAN DEFAULT false  -- mark when source data changes

-- Snapshot of portfolio state at save time
scenarioSnapshots
  - id UUID PRIMARY KEY
  - scenarioId UUID NOT NULL
  - snapshotData JSONB  -- properties, loans, valuations at save time
  - createdAt
```

**Factor config examples:**
- `interest_rate`: `{ "changePercent": 2.0, "applyTo": "all" | "propertyId" }`
- `vacancy`: `{ "propertyId": "...", "months": 3 }`
- `sell_property`: `{ "propertyId": "...", "salePrice": 850000, "sellingCosts": 25000 }`

---

## Factor Types & Calculations

**Financial Factors:**

| Factor | Config | Calculation Impact |
|--------|--------|-------------------|
| Interest rate change | `changePercent`, `applyTo` (all/specific loan) | Adjusts loan repayments from `startMonth`. Uses current loan balance and remaining term. |
| Rent change | `changePercent`, `propertyId` | Adjusts rental income. Can be negative for reduction. |
| Expense change | `changePercent`, `category` (optional) | Scales expenses by category or all. |
| Vacancy | `propertyId`, `months` | Zero rental income for period, expenses continue. |

**Buy/Sell Factors:**

| Factor | Config | Calculation Impact |
|--------|--------|-------------------|
| Sell property | `propertyId`, `salePrice`, `sellingCosts`, `settlementMonth` | Removes property from portfolio at month N. Calculates CGT using cost base (purchase + improvements - depreciation claimed). Applies 50% discount if held >12mo. Adds net proceeds to cash. |
| Buy property | `purchasePrice`, `deposit`, `loanAmount`, `interestRate`, `expectedRent`, `expenses` | Adds new property at month N. Creates loan liability. Adds projected income/expenses. |

**Stress Testing:**

Composite scenarios using templates:
- "Mild stress": +1% rates, 5% rent drop, 1mo vacancy
- "Severe stress": +2% rates, 10% rent drop, 3mo vacancy, 20% expense increase

**Tax Bracket Calculation:**

Uses user's marginal rate (from profile or override) to calculate actual tax payable on CGT events. Factors in other rental income for accurate bracket placement.

**Tax Profile Approach:**
- Smart default: estimate baseline from existing rental income data
- Override per scenario for different FY modeling
- Progressive profile building: if user overrides with same value multiple times, prompt "Save as default?"

---

## UI & User Flow

**Main route: `/reports/scenarios`**

**Scenario List View:**
- Card grid showing saved scenarios with name, description, last modified
- "Recent explorations" section at top (unsaved, auto-expires in 7 days)
- Branch indicator showing parent scenario if applicable
- Quick actions: Open, Duplicate, Delete

**Create/Edit View (form with sections):**

```
┌─────────────────────────────────────────────────────────┐
│ New Scenario                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Start from template: [Select...  ▼]                 │ │
│ │   • Blank  • Rate stress test  • Sell analysis      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Name: [Sell Unit 2 + rate rise            ]            │
│ Time horizon: [5 years ▼]                               │
│ Branch from: [None ▼] (or select saved scenario)       │
│                                                         │
│ ▶ Interest Rates          (click to expand)            │
│ ▼ Vacancy                                               │
│   │ Property: [Unit 2, 45 Smith St ▼]                  │
│   │ Duration: [3] months starting month [6]            │
│ ▶ Rent Changes                                          │
│ ▼ Sell Property                                         │
│   │ Property: [Unit 2, 45 Smith St ▼]                  │
│   │ Sale price: [$850,000]  Selling costs: [$25,000]   │
│   │ Settlement month: [12]                              │
│ ▶ Buy Property                                          │
│ ▶ Expense Changes                                       │
│                                                         │
│ [Run Scenario]                                          │
└─────────────────────────────────────────────────────────┘
```

Collapsed sections show "(not configured)" or summary like "+2% from month 3".

---

## Results View (Progressive Disclosure)

**Layer 1: Decision-Focused Summary (top)**

```
┌─────────────────────────────────────────────────────────┐
│ Scenario: Sell Unit 2 + rate rise                       │
│                                                         │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │ Net Position│ │ CGT Payable │ │ Cash After  │        │
│ │   +$127,400 │ │    $43,200  │ │   $312,800  │        │
│ │ over 5 years│ │  (FY 2026)  │ │  from sale  │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                         │
│ 💡 "Selling in month 12 with a 2% rate rise leaves you │
│    $127k better off than holding. Break-even sale      │
│    price is $780,000."                                  │
└─────────────────────────────────────────────────────────┘
```

**Layer 2: Comparison Table (middle)**

When comparing branches or multiple saved scenarios:

| Metric | Base Case | Sell Unit 2 | Sell + Rate Rise |
|--------|-----------|-------------|------------------|
| Monthly cash flow (avg) | $2,400 | $1,800 | $1,650 |
| Total equity (5yr) | $1.2M | $1.1M | $1.05M |
| Net yield | 4.2% | 3.8% | 3.5% |
| CGT liability | $0 | $38,500 | $43,200 |

Highlight best/worst values per row.

**Layer 3: Cash Flow Timeline (drill-down)**

Interactive line chart: income, expenses, net position by month. Toggle visibility of individual properties. Hover for monthly breakdown. Mark key events (sale settlement, vacancy period, rate change).

---

## Market Data Integration & Edge Cases

**Hybrid Data Approach:**

Default values come from current portfolio:
- Interest rates → current loan rates
- Rent → current rental income per property
- Expenses → trailing 12-month average by category
- Property values → latest valuation (manual or API)

**Optional "Refresh from market" button:**
- Fetches current RBA cash rate for rate baseline
- Fetches suburb median rent growth from CoreLogic/PropTrack (if integrated for valuations)
- Shows "Market data as of [date]" indicator
- User can still override any value

**Edge Cases:**

| Situation | Handling |
|-----------|----------|
| Property with no transaction history | Use portfolio averages, flag as "estimated" |
| Loan with variable rate | Show current rate, apply factor as offset (+2% means current + 2%) |
| Sell property with outstanding loan | Deduct loan payout from sale proceeds, include break costs if provided |
| Negative cash flow month | Highlight in red, show cumulative deficit |
| Scenario branches 3+ levels deep | Allow, show breadcrumb: Base → Stress Test → Sell Option |
| Source data changes after save | Mark projection as "stale", offer recalculate or keep snapshot |

**CGT Cost Base Tracking:**

Pull from existing data:
- Purchase price from property record
- Capital improvements from transactions tagged `capital_works`
- Depreciation claimed from tax reports
- Buying costs from documents/transactions

Show cost base breakdown in results when sell factor is active.

---

## Testing Strategy

**Unit Tests (projection engine):**

| Test | Purpose |
|------|---------|
| `applyInterestRateFactor` | Verify loan repayment recalculation at different rates |
| `applyVacancyFactor` | Zero income for period, expenses continue |
| `calculateCGT` | Cost base, 50% discount, marginal rate application |
| `calculateCGT` with depreciation | Clawback of claimed depreciation |
| `projectCashFlow` | Monthly aggregation over time horizon |
| `compositeFactors` | Multiple factors interact correctly |

**Integration Tests (tRPC routes):**

| Test | Purpose |
|------|---------|
| `scenario.create` | Creates scenario with factors, returns ID |
| `scenario.run` | Calculates projection, caches result |
| `scenario.save` | Creates snapshot, marks as saved |
| `scenario.compare` | Returns comparison table for multiple scenarios |
| `scenario.branch` | Creates child scenario with parent reference |

**E2E Tests (Playwright):**

| Flow | Steps |
|------|-------|
| Create from template | Select template → verify sections open → run → see results |
| Sell property scenario | Configure sell factor → run → verify CGT shown |
| Compare branches | Create base → branch → modify → compare side-by-side |
| Stale data handling | Save scenario → change property data → verify stale indicator |

**Edge Case Tests:**

- Scenario with all factor types active simultaneously
- Sell property that has a loan (payout calculation)
- Vacancy overlapping with sale month
- Negative equity scenarios

---

## Implementation Approach

**Phase 1: Core Engine (foundation)**
- Data model: scenarios, factors, projections tables
- Projection engine with basic factors: interest rate, vacancy, rent/expense changes
- Simple results view: summary metrics + cash flow chart
- No templates, no branching, no snapshots yet

**Phase 2: Buy/Sell & CGT**
- Sell property factor with full CGT calculation
- Buy property factor with loan creation
- Cost base breakdown display
- Tax bracket integration (profile + override)

**Phase 3: Power Features**
- Branching scenarios (parent reference, comparison view)
- Quick-start templates
- Snapshots on save
- "Recent unsaved" buffer
- Stale projection detection

**Phase 4: Polish**
- Market data refresh integration
- Decision-focused recommendations (natural language insights)
- Comparison table with highlighting
- Export scenario results to PDF

**Dependencies:**
- Existing: property valuations, loan data, transaction categories, tax reports (CGT cost base)
- New: user tax profile (can be added incrementally)
