# What-If Scenario Modelling UI — Design

## Problem

The scenario modelling backend is production-ready (8 tRPC procedures, full projection engine with 6 factor types, CGT calculator), but the frontend is prototype-quality:

- **Create page** (`/reports/scenarios/new`, 620 lines): DOM hacks (`document.querySelector`), raw JSON config display, no validation, no sliders
- **Detail page** (`/reports/scenarios/[id]`, 189 lines): Basic results with no comparison view, static chart with hardcoded colors
- **Not discoverable**: Not in sidebar, not on reports hub page
- **No comparison view**: Can't compare scenarios side-by-side

## Approach

**Incremental Polish (Approach A)** — Redesign the create/edit and results pages within the existing `/reports/scenarios/*` route structure. Add navigation, comparison view, and proper UX. No backend changes, no schema migrations.

## Section 1: Create/Edit Page Redesign

Replace the current 620-line prototype with a clean implementation.

### Factor Input Controls

| Factor Type | Input | Range | Step |
|-------------|-------|-------|------|
| Interest Rate | Slider + number input | -3% to +5% | 0.25% |
| Rent Change | Slider + number input | -20% to +20% | 1% |
| Expense Change | Slider + number input | -20% to +20% | 1% |
| Vacancy | Property Select + months input | 1-24 months | 1 |
| Sell Property | Property Select + price/costs inputs | Free-form | — |
| Buy Property | Price/deposit/loan/rate/rent/expense inputs | Free-form | — |

### Form Architecture

- **React state + Zod validation** — replace DOM hacks with proper `useForm` + `zodResolver`
- **Factor type selector** — dropdown to pick factor type, then render type-specific input card
- **Factor summary cards** — after adding a factor, show a human-readable card with:
  - Icon + label (e.g., "Interest Rate +1.5%")
  - Start month + duration (e.g., "Months 6-18")
  - Property name (if property-specific)
  - Edit + Remove buttons
- **Zod schemas per factor type** — typed configs, no `Record<string, unknown>`
- **Start month + duration fields** on every factor (already in schema)
- **Sell property** auto-populates estimated value from property data if available

### Layout

```
┌─────────────────────────────────────────────┐
│ ← Back to Scenarios                         │
│                                             │
│ Scenario Name: [___________]                │
│ Description:   [___________]                │
│                                             │
│ ┌─ Settings ──────────────────────────────┐ │
│ │ Time Horizon: [5 years ▾]              │ │
│ │ Tax Rate:     [37% ▾]                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ Factors ───────────────────────────────┐ │
│ │ [+ Add Factor ▾]                       │ │
│ │                                         │ │
│ │ ┌── Interest Rate +1.5% ─────── ✏ ✕ ┐ │ │
│ │ │ All properties · Months 6-18       │ │ │
│ │ └────────────────────────────────────┘ │ │
│ │                                         │ │
│ │ ┌── Vacancy 3 months ────────── ✏ ✕ ┐ │ │
│ │ │ 123 Main St · Months 12-15         │ │ │
│ │ └────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Save Draft]  [Run Projection →]            │
└─────────────────────────────────────────────┘
```

### Slider Component

- Dual display: slider track + editable number input synced together
- Color-coded: negative values show red accent, positive show green
- Thumb label shows current value
- Uses shadcn `Slider` component

## Section 2: Results Page Enhancement

### Comparison Strip

Before/after metrics displayed as a horizontal card row:

| Metric | Source |
|--------|--------|
| Monthly Cash Flow | `summary.monthlyNetCashFlow` |
| Annual Return | `summary.annualReturn` |
| Total Equity | `summary.totalEquity` at end |
| Portfolio Value | `summary.portfolioValue` at end |
| Tax Position | `summary.totalTaxImpact` |
| Net Worth Change | Derived from equity delta |

Each metric card shows:
- Current value (before scenario)
- Projected value (after scenario)
- Delta with arrow (green up = better, red down = worse)
- Percentage change

### Interactive Chart

- Replace hardcoded hex colors with CSS variables (`var(--color-chart-1)` etc.)
- Add `ReferenceLine` markers at months where factors activate:
  - Rate change months → dashed vertical line with label
  - Vacancy periods → shaded region
  - Sale/purchase months → solid vertical line with icon
- Recharts `Legend` component for toggling line visibility
- Tooltip shows all values formatted with `formatCurrency`

### CGT Breakdown Card

Only shown when a `sell_property` factor exists in the scenario:

```
┌─ Capital Gains Tax Breakdown ───────────┐
│                                          │
│ Estimated Sale Price    $850,000         │
│ Less: Cost Base        -$650,000         │
│ Capital Gain            $200,000         │
│ Less: 50% Discount     -$100,000         │
│ Taxable Gain            $100,000         │
│ Estimated Tax @ 37%     $37,000          │
│ ──────────────────────────               │
│ Net Proceeds            $163,000         │
└──────────────────────────────────────────┘
```

Values come from existing `calculateCGT` function in `projection.ts`.

### Human-Readable Factors Card

List all scenario factors in plain English (same cards from create page, but read-only). This replaces the current raw JSON display.

### Layout

```
┌─────────────────────────────────────────────┐
│ ← Back │ Scenario Name        [Edit] [Run]  │
│                                              │
│ ┌─ Summary ────────────────────────────────┐ │
│ │ Cash Flow  │ Return  │ Equity │ Value    │ │
│ │ +$1,200/mo │ 5.2%    │ $340K  │ $1.2M   │ │
│ │ ↑ +$400    │ ↑ +1.1% │ ↑ +$40K│ ↑ +$80K │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌─ Cash Flow Projection (chart) ───────────┐ │
│ │            [interactive chart]            │ │
│ │  ╌╌╌ rate change ─── vacancy ─── sale    │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌─ CGT Breakdown ┐  ┌─ Scenario Factors ──┐ │
│ │ (if sell exists)│  │ (human-readable)    │ │
│ └─────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Section 3: Navigation, Comparison & Testing

### Sidebar Navigation

Add "Scenarios" item to the "Reports & Tax" section in `Sidebar.tsx`:
- Icon: `GitBranch` (from lucide-react)
- Position: after existing items in Reports & Tax
- No feature flag (scenario backend already deployed)

### Reports Hub

Add a scenario card to `/reports` hub page with description and link.

### Comparison Page (`/reports/scenarios/compare`)

New page for side-by-side scenario comparison:

- **Scenario selector**: Multi-select dropdown (2-4 scenarios max)
- **Side-by-side metrics table**: Same 6 metrics from comparison strip, one column per scenario
- **Overlaid chart**: All selected scenarios on one Recharts chart, different line styles (solid, dashed, dotted)
- **Color-coded**: Each scenario gets a unique CSS variable chart color

### Factor Description Formatter

Utility function to convert factor config into human-readable strings:
- `formatFactorDescription(type, config, properties)` → "Interest rate +1.5% on all properties, months 6-18"
- Used by both create page factor cards and results page factors card

### Testing

- **Unit tests** for Zod factor schemas (valid/invalid configs per type)
- **Unit tests** for `formatFactorDescription` utility
- No E2E tests in this PR (scenarios require complex state setup)

## Out of Scope

- Backend changes (all 8 procedures already exist)
- Schema migrations (all 4 tables already exist)
- New factor types (6 types sufficient for MVP)
- Scenario templates/presets (future enhancement)
- PDF export of results (future enhancement)

## Technical Constraints

- All chart colors must use CSS variables (not hardcoded hex)
- Factor configs must use typed Zod schemas (not `Record<string, unknown>`)
- No DOM manipulation — all state via React hooks
- Existing projection engine API unchanged
- `writeProcedure` for create/update/delete (already implemented)
