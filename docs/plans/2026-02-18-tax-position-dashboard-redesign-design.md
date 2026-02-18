# Tax Position Dashboard Redesign — Design

**Goal:** Enhance the existing `/reports/tax-position` page with per-property rental breakdown, tax optimization suggestions, and visual polish to create a premium single-page tax dashboard.

**Approach:** Enhanced single page (Approach A) — hero card → summary strip → income/tax grid → per-property accordion → optimization tips. Everything visible by scrolling, no tabs or separate pages.

**No new schema, tables, or migrations.** One new tRPC procedure + UI redesign.

---

## Page Layout (top to bottom)

1. **Header** — "Tax Position" title + FY selector (existing)
2. **Hero Card** — Large refund/owing amount, property savings callout, forecast projection badge (redesigned)
3. **Summary Strip** — 4 stat cards: Taxable Income, Marginal Rate, Total Deductions, Property Savings
4. **Income & Tax Grid** — 2-column: editable profile (collapsible when complete) + tax calculation breakdown
5. **Per-Property Breakdown** — Expandable table: property → income/expenses/net → ATO category detail
6. **Tax Optimization Tips** — Active suggestions from `taxOptimization.getSuggestions` with estimated savings

## New Backend Procedure

`taxPosition.getPropertyBreakdown` — groups FY transactions by propertyId and category.

```typescript
{
  properties: Array<{
    propertyId: string;
    address: string;
    suburb: string;
    income: number;
    expenses: number;
    netResult: number;
    categories: Array<{
      category: string;
      label: string;
      atoReference: string;
      amount: number;
      transactionCount: number;
    }>;
  }>;
  unallocated: {
    income: number;
    expenses: number;
    netResult: number;
    categories: Array<{ ... }>;
  };
  totals: {
    income: number;
    expenses: number;
    netResult: number;
  };
}
```

Implementation: query all FY transactions with propertyId, join properties for address/suburb, group in-memory by property then category using `categories.ts` metadata.

## Visual Polish

**Hero Card:**
- text-5xl refund/owing number
- Subtle gradient background (green/amber) with dark mode support
- Property savings + forecast as inline badges

**Summary Strip:**
- 4 compact stat cards, 2x2 on mobile, 4-across on desktop
- Taxable Income | Marginal Rate | Total Deductions | Property Savings

**Income & Tax Grid:**
- Collapsible "Edit Profile" section (defaults collapsed when profile is complete)
- Read-only summary when collapsed
- Tax calculation card with tighter spacing

**Per-Property Breakdown:**
- Table with expandable rows via Collapsible
- Category rows show ATO reference badge, label, amount, transaction count
- Transaction count links to `/transactions?propertyId=X&category=Y`
- Unallocated row at bottom with warning icon

**Tax Optimization Tips:**
- Compact suggestion cards: title, estimated savings badge, View/Dismiss actions
- Empty state: "No optimization suggestions right now"

## Component Extraction

| Component | Purpose |
|-----------|---------|
| `TaxHeroCard` | Hero refund/owing display with gradient + badges |
| `TaxSummaryStrip` | 4-stat row (taxable income, rate, deductions, savings) |
| `PropertyBreakdownTable` | Expandable per-property table with category detail |
| `TaxOptimizationSection` | Suggestions list from existing endpoint |

Existing components unchanged: `SetupWizard`, `ForecastSummary`, `ConfidenceBadge`, `ForecastAnnotation`.

## Data Queries (parallel)

- `taxPosition.getProfile` (existing)
- `taxPosition.getRentalResult` (existing)
- `taxPosition.calculate` (existing, reactive to form changes)
- `taxPosition.getPropertyBreakdown` (new)
- `taxForecast.getForecast` (existing)
- `taxOptimization.getSuggestions` (existing)

## Edge Cases

- **No profile** → Setup wizard (existing)
- **No transactions** → Empty state in property breakdown
- **Unallocated transactions** → Separate row with warning + link to assign
- **Single property** → Table still shows for category breakdown value
- **Mid-year FY** → YTD actuals only in breakdown, forecast in hero card
- **Salary = 0** → Calculator runs with rental-only position

## Testing

- Unit tests for `getPropertyBreakdown`: grouping logic, category mapping, unallocated bucket, empty transactions
- No new E2E tests — manual verification on staging
