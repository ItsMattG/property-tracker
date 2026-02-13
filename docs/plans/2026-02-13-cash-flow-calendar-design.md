# Cash Flow Calendar — Design Document

**Date:** 2026-02-13
**Task:** property-tracker-qop
**Status:** Approved

## Overview

Calendar view showing upcoming/recurring loan repayments and rental income across all properties. Shows projected bank account balances to help users plan cash flow and ensure sufficient funds for upcoming obligations.

## Decisions

- **Location:** Full dedicated page (`/cash-flow`) + compact dashboard widget (next 14 days)
- **Views:** Calendar grid and timeline/list with user toggle
- **Balance projection:** Area chart with projected running balance
- **Time horizon:** User-selectable 3, 6, or 12 months
- **Granularity:** Portfolio-wide default with per-property filter dropdown
- **Calendar component:** Custom-built (Tailwind + CSS grid), no external calendar library
- **Forecast integration:** Overlay data from existing `forecastScenarios` system

## Data Layer

### Event Sources

1. **Expected transactions** — from `recurringTransactions` → `expectedTransactions` table. Rent income, council rates, insurance, body corporate, etc. Status: `pending | matched | missed | skipped`.
2. **Loan repayments** — derived from `loans.repaymentAmount` + `loans.repaymentFrequency`. Generated on-the-fly using existing `calculateNextDates()` logic (not persisted).
3. **Actual transactions** — past transactions from `transactions` table for the historical portion.
4. **Forecast scenario projections** — from `cashFlowForecasts` table. When a default scenario exists, projected monthly income/expense overlays as lighter/dashed entries.

### New tRPC Procedure: `cashFlow.getCalendarEvents`

- **Input:** `{ startDate, endDate, propertyId?, scenarioId? }`
- **Returns:**
  - `events[]`: unified list — `{ date, amount, category, type (income|expense), source (expected|loan|actual|forecast), status (pending|matched|missed|confirmed|skipped), propertyId, propertyAddress, description }`
  - `projectedBalances[]`: daily running totals starting from current bank account balances — `{ date, balance, isForecasted }`
- Merges all four sources, deduplicates matched expected+actual pairs
- Balance calculation is server-side

### No New Tables

Reuses: `expectedTransactions`, `transactions`, `loans`, `cashFlowForecasts`, `bankAccounts`.

## Full Page UI (`/cash-flow`)

### Layout

```
Page Header: "Cash Flow" + subtitle
Controls: [Property filter] [3mo|6mo|12mo] [Calendar|List toggle]

Balance Projection Chart (Card)
  AreaChart (Recharts):
  - Solid green area = concrete projection (recurring + loans)
  - Dashed blue band = forecast scenario overlay
  - Red dashed line = low-balance threshold
  - X-axis: dates, Y-axis: $ balance

Calendar Grid View (when toggled)
  Custom 7-column CSS grid, month navigation arrows
  Each cell: date number + colored dot indicators
  - Green dot = income
  - Red dot = expense/repayment
  - Amber dot = missed
  - Hollow/dashed dot = forecast
  Today: ring-2 ring-primary highlight
  Click day → slide-out sheet with event details

Timeline/List View (when toggled)
  Chronological list grouped by date
  Each date group: date label + net amount
  Each event: colored dot + description + property + amount + status badge
  Status badges: matched=green check, pending=hollow circle, missed=amber warning
```

### Day Detail Panel

Slide-out sheet (right side) showing all events for the selected day:
- Date header
- List of events with full details (amount, category, property, status)
- Running balance at end of day
- Actions: mark as skipped, view linked transaction

## Dashboard Widget

Compact card in the main dashboard grid showing next 14 days:

```
Header: icon badge + "Upcoming Cash Flow" + "View all →" link
Subtext: "Next 14 days"

Balance sparkline: tiny AreaChart (~40px height, no axes)
Shows: current balance → projected balance

Event list: max 3-4 upcoming events
  Each: dot + description + property + amount (color-coded)
Overflow: "N more events →" link to /cash-flow
```

- Standard `Card` with `animate-card-entrance`
- Fits single column width in dashboard grid

## Visual Design

### Colors (matching existing design system)

- Income: `#22c55e` (green-500) / `text-emerald-500`
- Expenses: `#ef4444` (red-500) / `text-red-500`
- Net/Balance: `#3b82f6` (blue-500) / `text-blue-500`
- Missed: `#f59e0b` (amber-500) / `text-amber-500`
- Forecast overlay: blue with 30% opacity / dashed borders
- Negative balance zone: red area fill below $0

### Components

- Recharts `AreaChart` for balance projection (matches CashFlowWidget pattern)
- Recharts `AreaChart` (tiny, no axes) for dashboard sparkline
- Custom calendar grid: CSS grid, `bg-card` cells, `hover:bg-muted`
- Sheet component for day detail slide-out
- Select for property filter, ToggleGroup for view/horizon toggles
- Skeleton loaders while data fetches

### Dark Mode

All colors via CSS variables — automatic via `[data-theme="dark"]`. No special handling needed.

## Edge Cases

- **No recurring transactions:** CTA to set up recurring transactions
- **No loans:** Loan repayment section simply omitted
- **No forecast scenario:** Forecast overlay doesn't render
- **Sold properties:** Excluded from future projections (status = "sold")
- **Missed events:** Amber warning icon + "missed" badge
- **Multiple events per day:** Dots stack horizontally in calendar; list shows all
- **Negative balance:** Chart area turns red below $0
- **Loading:** Skeleton cards and gray chart placeholder

## Performance

- Events fetched per visible date range (not all months at once)
- Date range queries use existing indexes on `expectedTransactions` and `transactions`
- Balance calculation server-side (no bulk transaction data shipped to client)
- Dashboard widget fetches independently with narrow 14-day range
