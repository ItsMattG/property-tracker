# Multi-Property Portfolio View Design

**Date:** 2026-01-24
**Status:** Approved

## Overview

A dedicated portfolio view that aggregates all investment properties into three view modes: Summary Cards, Comparison Table, and Aggregated Totals. Enables users to track property values over time, compare performance across properties, and see portfolio-wide metrics.

---

## Data Model

### New Table: `propertyValues`

```sql
propertyValues
- id (uuid, pk)
- propertyId (uuid, fk -> properties)
- userId (uuid, fk -> users)
- estimatedValue (decimal 12,2)
- valueDate (date)
- source (enum: 'manual' | 'api')
- notes (text, nullable)
- createdAt (timestamp)
```

Tracks value history per property. Latest value fetched with `ORDER BY valueDate DESC LIMIT 1`. The `source` field supports future API integration (PropTrack, CoreLogic).

### Calculations (from existing data)

- **Equity** = Latest estimated value - Sum of loan balances for property
- **LVR** = (Sum of loan balances / Latest estimated value) × 100
- **Cash flow** = Sum of income transactions - Sum of expense transactions (for selected period)
- **Gross yield** = (Annual rental income / Estimated value) × 100
- **Net yield** = ((Annual income - Annual expenses) / Estimated value) × 100

---

## Routes & Navigation

### New Routes

- `/portfolio` - Main portfolio view with three view modes
- `/properties/[id]/value` - Add/edit property value estimate

### Navigation Updates

- Add "Portfolio" to sidebar above "Properties"
- Portfolio is primary entry point for viewing investments
- Clicking property card/row navigates to `/properties/[id]`

### URL State

View mode, time period, and filters stored in query params:
- `/portfolio?view=cards`
- `/portfolio?view=aggregate&period=quarterly`
- `/portfolio?view=cards&state=NSW&status=active`

---

## View 1: Summary Cards

### Layout

- Grid: 1 column mobile, 2 tablet, 3 desktop
- Toolbar: View toggle, Sort dropdown, Filter dropdowns, Time period selector

### Card Content

- Property address (suburb, state)
- Entity name badge
- 2x2 metrics grid:
  - Current value
  - Loan balance
  - Equity
  - LVR (green <60%, yellow 60-80%, red >80%)
- Cash flow for selected period (green positive, red negative)
- Warning indicators (no value set, disconnected bank)

### Card Actions

- Click → navigate to `/properties/[id]`
- "Update Value" button → opens modal

### Empty States

- No properties: "Add your first property" CTA
- No values set: Prompt to add estimated values

---

## View 2: Comparison Table

### Layout

- Horizontal scrolling table, properties as columns
- First column sticky with metric labels
- Same toolbar as Cards view

### Metrics (rows)

- Purchase price
- Current value
- Capital growth ($ and %)
- Loan balance
- Equity
- LVR
- Gross yield
- Net yield
- Cash flow (selected period)
- Annual income
- Annual expenses

### Formatting

- Best performer per row: green highlight
- Worst performer per row: subtle red highlight
- Consistent currency/percentage formatting

### Actions

- Column header click → property detail
- Export button → CSV download

### Responsive

- Mobile: Show "Switch to Cards view" message with button

---

## View 3: Aggregated Totals

### Layout

- Summary cards row (portfolio totals)
- Two charts side by side (stack on mobile)
- Property breakdown table

### Summary Cards (first row)

- Total portfolio value
- Total debt
- Total equity
- Portfolio LVR

### Summary Cards (second row)

- Total properties count
- Cash flow (based on period selector)
- Average yield (weighted by property value)

### Charts (Tremor)

- **DonutChart**: Equity distribution by property
- **BarChart**: Cash flow by property (positive/negative bars)

### Property Breakdown Table

- Each property with key metrics
- Sortable columns
- Click row → property detail

---

## API Design

### New Router: `propertyValue`

```typescript
propertyValue.list        // Get all values for a property (history)
propertyValue.getLatest   // Get most recent value for a property
propertyValue.create      // Add new value estimate
propertyValue.delete      // Remove a value entry
```

### New Router: `portfolio`

```typescript
portfolio.getSummary      // Aggregated totals for all properties
portfolio.getPropertyMetrics  // Per-property metrics
```

### Query: `portfolio.getSummary`

- Input: `{ period: 'monthly' | 'quarterly' | 'annual', state?: string, entityType?: string, status?: string }`
- Returns: Total value, total debt, total equity, portfolio LVR, cash flow, property count

### Query: `portfolio.getPropertyMetrics`

- Input: Same filters + `{ sortBy: 'cashFlow' | 'equity' | 'lvr' | 'alphabetical', sortOrder: 'asc' | 'desc' }`
- Returns: Array of properties with calculated metrics

---

## Filters & Sorting

### Sort Options

- Cash flow (high to low / low to high)
- Equity (high to low / low to high)
- LVR (high to low / low to high)
- Alphabetical (A-Z / Z-A)

### Filter Options

- State (NSW, VIC, QLD, etc.)
- Entity type (from entityName field)
- Status (active, sold)

### Time Period Selector

- Monthly
- Quarterly
- Annual

Affects cash flow calculations across all views.

---

## Testing Approach

### Unit Tests (Calculations)

- Equity calculation with multiple loans
- LVR calculation (edge case: no loans = 0%)
- Cash flow aggregation for different periods
- Yield calculations (handle zero value)
- Best/worst performer detection

### Router Tests

- `propertyValue.create` - adds value entry
- `propertyValue.list` - returns history sorted by date
- `portfolio.getSummary` - returns correct aggregates
- `portfolio.getPropertyMetrics` - respects filters and sorting
- Authorization - users see only their data

### Component Tests

- Cards render correct metrics
- View toggle switches views
- Filters update query params
- Charts receive correct data shape

### Edge Cases

- Property with no value set
- Property with no loans (LVR = 0)
- Property with no transactions (cash flow = $0)
- Empty portfolio

---

## Dependencies

- **Tremor** - Charts (DonutChart, BarChart)
- Existing: shadcn/ui, Tailwind, tRPC, Drizzle

---

## Implementation Notes

- Calculations done server-side for performance
- Latest property value cached/indexed for fast lookups
- CSV export uses same data as table view
- Mobile: Cards and Aggregate views only (Table prompts switch)
