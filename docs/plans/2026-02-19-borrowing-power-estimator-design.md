# Borrowing Power Estimator — Design

**Beads task:** property-tracker-t7y

**Goal:** Full APRA-style serviceability calculator with what-if scenarios, pre-filled from portfolio data, at `/tools/borrowing-power`. Pure client-side — no new backend.

**V1 Scope:** Manual-input calculator using standard AU serviceability formulas. Later enriched with Basiq bank feed data when production access is available.

---

## Approach

Pure client-side calculation. All arithmetic runs in the browser via a `calculateBorrowingPower()` utility. Portfolio data pre-filled from existing `portfolio.getBorrowingPower` tRPC query. Scenarios are different input sets compared side-by-side. No new schema, no new backend procedures.

---

## Calculation Engine

### Assessment Rate

```
assessmentRate = max(floorRate, productRate + 3.0%)
```

APRA buffer is 3 percentage points (confirmed current as of Feb 2026).

### Income Shading

| Source | Shading | Rationale |
|--------|---------|-----------|
| Salary/wages (net) | 100% | Primary stable income |
| Rental income | 80% | Vacancy/maintenance buffer |
| Other (dividends, business) | 80% | Variable income discount |

### Living Expenses

Uses the higher of:
- User-declared monthly living expenses
- HEM (Household Expenditure Measure) benchmark for household type

HEM benchmarks (approximate, hardcoded as constants, updated annually):

| Household Type | Monthly HEM |
|----------------|-------------|
| Single, no dependants | $1,400 |
| Single + 1 dep | $1,800 |
| Single + 2 deps | $2,100 |
| Single + 3+ deps | $2,400 |
| Couple, no dependants | $2,100 |
| Couple + 1 dep | $2,400 |
| Couple + 2 deps | $2,700 |
| Couple + 3+ deps | $3,000 |

### Borrowing Power Formula

```
monthlyIncome = shadedSalary + shadedRent + shadedOther
monthlyExpenses = max(declaredLiving, hemBenchmark) + existingCommitments
monthlySurplus = monthlyIncome - monthlyExpenses
maxLoan = PV(assessmentRate/12, loanTermMonths, monthlySurplus)
```

`PV` = present value of an annuity. The max loan producing a repayment equal to the monthly surplus at the assessment rate.

### DTI Check

New APRA rule (Feb 2026): flag if total debt / gross annual income >= 6.0.

Traffic light: green < 4, amber 4–6, red >= 6 (with APRA warning).

---

## UI

### Page Layout

**Route:** `/tools/borrowing-power`

3 panels — inputs left, result right, scenarios bottom. Responsive: stacks vertically on mobile.

### Panel A: Inputs

Collapsible sections, pre-filled where portfolio data exists:

1. **Income** — Gross salary (manual), rental income (pre-filled), other income (manual)
2. **Household** — Relationship status (single/couple), dependants (0–6). Drives HEM lookup.
3. **Living Expenses** — Monthly amount (manual). HEM benchmark shown alongside — whichever is higher is used, with explanatory note.
4. **Existing Commitments** — Property loans (pre-filled, editable), credit card limits (manual, 3.8% of limit as monthly commitment), car/personal loans (manual monthly), HECS/HELP balance (manual, repayment from income thresholds)
5. **Loan Settings** — Target interest rate (default ~6.2%), loan term (default 30 years), floor rate (default 5.5%)

### Panel B: Result

- Headline: "Estimated borrowing power: $XXX,XXX"
- Assessment rate used
- Monthly repayment at that amount
- DTI ratio with traffic light
- Surplus after repayment
- Breakdown bar: income vs expenses vs repayment

### Panel C: Scenarios

- "Add scenario" button — duplicates current inputs
- Up to 3 scenarios side-by-side
- Each shows: borrowing power, monthly repayment, DTI, surplus
- Differences from base scenario highlighted green/red

### States

- **Loading:** Skeleton while portfolio data fetches
- **Ready:** Form pre-filled, result updates live as inputs change
- **Empty portfolio:** All fields blank, manual entry

---

## Navigation

New "Tools" section in sidebar (after Analytics, before settings):
- Section icon: `Wrench` (lucide-react)
- First item: "Borrowing Power" with `Calculator` icon
- Always visible (not plan-tier gated)

---

## Feature Flag

`borrowingPowerEstimator: true` in `src/config/feature-flags.ts`.

Route mapping: `"/tools/borrowing-power": "borrowingPowerEstimator"`.

---

## Testing

- `src/lib/__tests__/borrowing-power-calc.test.ts` — pure function tests:
  - Income shading (salary 100%, rent 80%, other 80%)
  - HEM lookup by household type (all 8 combos)
  - Max loan PV calculation (known input → known output)
  - DTI ratio and threshold classification
  - Assessment rate = max(floor, product + 3%)
  - Edge cases: zero income → $0, negative surplus → $0

---

## Not in V1

- Persistence / saved estimates
- Basiq bank feed auto-population (requires production access)
- Multi-lender comparison profiles
- PDF export of estimate
- Stamp duty / purchase cost integration
