# Portfolio Benchmarking Dashboard — Design

**Beads task:** property-tracker-ui7

**Goal:** Per-property performance ranking table with summary gauges, comparing properties against portfolio averages. Sortable by score, yield, and expense ratio. Pure frontend — reuses existing `performanceBenchmarking.getPortfolioScorecard` endpoint.

**V1 Scope:** New page at `/analytics/benchmarking`. Summary gauge row + sortable ranking table. Portfolio-only comparison (no suburb medians). Core 4 metrics: performance score, gross yield, net yield, expense ratio.

---

## Data Source

Single existing query — `performanceBenchmarking.getPortfolioScorecard`. Already returns:

- `properties[]` — each with `grossYield`, `netYield`, `annualExpenses`, `annualRent`, `performanceScore`, `scoreLabel`, `address`, `suburb`, `state`, `currentValue`
- `averageScore`, `averageGrossYield`, `averageNetYield`
- `totalAnnualCashFlow`, `totalAnnualRent`, `totalAnnualExpenses`, `totalCurrentValue`
- `bestPerformer`, `worstPerformer`

No new backend work. Expense ratio derived client-side: `(annualExpenses / annualRent) * 100`.

---

## UI

### Summary Gauges (Top Row)

4 cards in responsive grid (1 col mobile, 2 col md, 4 col lg):

| Card | Value | Subtitle |
|------|-------|----------|
| Average Score | Integer + score label badge | "Portfolio average performance" |
| Avg Gross Yield | X.X% | "Average across properties" |
| Total Annual Cash Flow | $X,XXX | "Net rental income minus expenses" |
| Best/Worst | Property address | Score badge for each |

### Ranking Table

| Column | Format | Sortable | Color Logic |
|--------|--------|----------|-------------|
| Rank | Auto-numbered | No (derived from sort) | — |
| Property | Address (bold) + suburb/state (muted) | No | — |
| Score | Integer + badge | Yes (default desc) | Green > avg, Red < avg |
| Gross Yield | X.X% | Yes | Green > avg, Red < avg |
| Net Yield | X.X% | Yes | Green > avg, Red < avg |
| Expense Ratio | X.X% | Yes | Green < avg (lower is better), Red > avg |

- Default sort: Score descending
- Click column header to toggle sort direction
- Sort arrow indicator on active column
- Row click navigates to `/properties/[id]`
- Color threshold: ±5% of portfolio average = neutral

### States

- **Loading:** Skeleton gauges + table rows
- **Empty:** "Add properties and transactions to see portfolio benchmarks" with link to `/properties/new`
- **Data:** Gauges + table

---

## Navigation

Add "Benchmarking" link to analytics section nav, alongside existing "Scorecard" page.

---

## Feature Flag

`portfolioBenchmarking: true` in `src/config/feature-flags.ts`.

---

## Testing

- No new backend tests (reusing tested endpoint)
- Unit test: sort utility function (3 cases — sort by score, yield, expense ratio with asc/desc)
- Component: loading, empty, data states render correctly

---

## Not in V1

- Suburb median comparison column (needs PropTrack/CoreLogic API)
- Export to PDF/CSV
- Time-series trend charts (score over months)
- Goal setting / target thresholds
- Alerts when properties drop below benchmarks
