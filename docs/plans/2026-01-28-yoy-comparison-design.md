# Key Expenses Year-over-Year Comparison — Design

**Date:** 2026-01-28
**Phase:** 9.3
**Status:** Final

## Overview

A dedicated report page at `/reports/yoy-comparison` that compares expense categories across two financial years. Defaults to current FY vs prior FY, with a dropdown to change the comparison year. Shows portfolio-wide totals and per-property breakdowns.

## Decisions

| Decision | Choice |
|----------|--------|
| Location | Dedicated report page (7th card on reports hub) |
| Categories | All categories with data, 6 key expenses highlighted first |
| Visualization | Table with color-coded change indicators |
| Year selection | Current vs prior as default, dropdown to change comparison year |
| Scope | Portfolio summary + per-property breakdown (collapsible) |

## Key Expenses

Six recurring categories highlighted with visual distinction:

- `land_tax` (ATO D9)
- `council_rates` (ATO D5)
- `water_charges` (ATO D17)
- `repairs_and_maintenance` (ATO D13)
- `insurance` (ATO D7)
- `body_corporate` (ATO D2)

## Data Flow

1. Page loads, fetches available years via existing `reports.getAvailableYears`
2. Default: current FY vs prior FY. User can change comparison year via dropdown.
3. Calls `yoyComparison.getComparison({ currentYear, comparisonYear })`
4. Service queries transactions for both years, groups by property and category
5. Computes dollar change and percentage change per category
6. Flags significant changes (>10%)
7. Returns portfolio totals + per-property breakdowns

No new DB tables — purely computed from existing transactions.

## API Response Shape

```typescript
interface YoYCategoryComparison {
  category: string;
  label: string;
  atoCode: string;
  isKeyExpense: boolean;
  currentYear: number;
  comparisonYear: number;
  change: number;
  changePercent: number | null; // null if comparisonYear is 0
  isSignificant: boolean;       // |changePercent| > 10
}

interface YoYPropertyBreakdown {
  propertyId: string;
  address: string;
  categories: YoYCategoryComparison[];
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}

interface YoYComparisonResult {
  currentYear: number;
  comparisonYear: number;
  currentYearLabel: string;
  comparisonYearLabel: string;
  portfolio: YoYCategoryComparison[];
  properties: YoYPropertyBreakdown[];
  totalCurrent: number;
  totalComparison: number;
  totalChange: number;
  totalChangePercent: number | null;
}
```

Sort order: key expenses first (in order listed above), then remaining categories alphabetically. Categories with zero in both years are excluded.

## UI Layout

### Header Bar

Title "Year-over-Year Comparison" with dropdown on the right. Dropdown label: "Compare against:" with available prior years.

### Portfolio Summary Card

Aggregated comparison table with columns:

| Category | {comparisonYearLabel} | {currentYearLabel} | Change | % Change |

- Key expenses render first with subtle blue left border accent
- Separator row between key expenses and other categories
- Dollar amounts right-aligned, AUD currency format
- Change column: green for decreases (savings), amber for increases
- % Change: same color logic with up/down arrow icons
- Significant changes (>10%) get background highlight on the row
- Bold totals row at bottom

### Per-Property Sections

One collapsible Card per property below the portfolio card. Same table structure scoped to that property. Default collapsed. Only properties with data in at least one year shown.

## File Structure

### New Files

- `src/server/services/yoy-comparison.ts` — Service with comparison logic
- `src/server/services/__tests__/yoy-comparison.test.ts` — Unit tests for pure functions
- `src/server/routers/yoyComparison.ts` — tRPC router
- `src/app/(dashboard)/reports/yoy-comparison/page.tsx` — Page wrapper
- `src/components/reports/YoYComparisonContent.tsx` — Client component with queries/state
- `src/components/reports/YoYComparisonTable.tsx` — Reusable table component

### Modified Files

- `src/server/routers/_app.ts` — Register `yoyComparison` router
- `src/app/(dashboard)/reports/page.tsx` — Add 7th report card

### No New Dependencies

Uses existing shadcn/ui (Table, Card, Collapsible, Select) and Lucide icons (TrendingUp, TrendingDown, ChevronDown).

## Testing

Unit tests (TDD) for pure functions:
- Change computation (dollar and percentage)
- Significance flagging (>10% threshold)
- Key expense sorting and separation
- Zero-exclusion logic (both years zero → excluded)
- Null percentage when comparison year is zero
