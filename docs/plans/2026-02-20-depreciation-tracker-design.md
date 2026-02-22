# Depreciation Schedule Tracker (Div 40/43) — Design

**Task:** property-tracker-4td (P1)
**Date:** 2026-02-20
**Approach:** Pure calculation engine (Approach A)

## Summary

Full depreciation tracker for Australian property investors covering Division 40 (plant & equipment), Division 43 (capital works), and low-value pool. Pure function calculation engine with on-demand projections, inline asset management UI on property detail page, and per-FY claim tracking.

## Data Model

### Existing tables (unchanged)

- `depreciationSchedules` — one per property, links to PDF document
- `depreciationAssets` — line items (name, category, cost, effective life, method, yearly deduction, remaining value)

### New columns on `depreciationAssets`

- `purchaseDate` (date) — when asset was acquired (needed for pro-rata first year)
- `poolType` (enum: `individual` | `low_value` | `immediate_writeoff`) — how this asset is depreciated
- `openingWrittenDownValue` (numeric) — value at start of current schedule period

### New table: `depreciationClaims`

- `id`, `assetId` (FK to depreciationAssets, nullable), `scheduleId` (FK), `financialYear` (int, e.g. 2026 = FY25-26), `amount` (numeric), `claimedAt` (timestamp)
- One row per asset per FY when user marks depreciation as claimed
- For low-value pool: one claim row per FY for pool aggregate (assetId nullable, scheduleId FK instead)

### New table: `capitalWorks`

- `id`, `propertyId`, `userId`, `description`, `constructionDate`, `constructionCost`, `claimStartDate`
- Separate from Div 40 assets — Div 43 is always 2.5% over 40 years, no method choice
- Linked to property, not to a schedule (capital works exist independent of QS reports)

## Calculation Engine

Pure functions in `src/server/services/depreciation-calculator.ts`.

### Div 40 — Plant & Equipment

- **Diminishing Value:** `baseValue * (200% / effectiveLife)`, first year pro-rata by days held (purchase date to Jun 30)
- **Prime Cost:** `cost * (100% / effectiveLife)`, same first-year pro-rata

### Low-Value Pool

- Existing pool items: 18.75% of opening balance
- New additions in-year: 37.5% (irrespective of purchase date — ATO simplification)
- Assets ≤$300: instant write-off (full cost in year of purchase)
- Assets $300–$1,000: enter low-value pool
- Assets with remaining value < $1,000 can be moved to pool voluntarily

### Div 43 — Capital Works

- 2.5% of construction cost per year for 40 years
- First year pro-rata from claim start date
- Post-Sep 1987 construction only (pre-1987 4% rate deferred)

### Projection

- `projectSchedule(assets, capitalWorks, fromFY, toFY)` returns array of `{ financialYear, div40Total, div43Total, lowValuePoolTotal, grandTotal }`
- Computed on demand, never stored
- Default: current FY + 10 years forward

### Edge Cases

- Asset fully depreciated (remaining = 0) → excluded from future projections
- Mid-year disposal → pro-rata final year deduction
- Method switch (DV to PC) → allowed once per asset, uses written-down value as new cost base

## UI Design

### New tab: `/properties/[id]/depreciation`

#### 1. Summary Cards (top row)

- "This FY Deduction" — total claimable for current FY across Div 40 + 43
- "Total Remaining Value" — sum of all unclaimed depreciation
- "Assets Tracked" — count of active assets
- "Capital Works" — number of Div 43 items

#### 2. Asset Register (main section)

Tabbed: "Plant & Equipment" | "Capital Works" | "Low-Value Pool"

**Plant & Equipment tab:**
- Table: Asset Name, Category, Cost, Method (DV/PC toggle), Effective Life, This FY Deduction, Remaining Value, Actions
- Inline "Add Asset" row at bottom
- "Upload QS Report" button triggers existing PDF extraction
- Bulk action: "Move to Low-Value Pool" for eligible assets

**Capital Works tab:**
- Table: Description, Construction Date, Cost, Annual Deduction (2.5%), Years Remaining, Actions
- Inline add row

**Low-Value Pool tab:**
- Pool balance, current year deduction, list of pooled assets
- Instant write-offs for current FY shown separately

#### 3. Year-by-Year Projection (bottom section)

- Collapsible accordion, default open for current FY + 5 years
- Table: FY | Div 40 | Div 43 | Low-Value Pool | Total
- Each row expandable to show per-asset breakdown
- "Mark as Claimed" button per FY row

## Router & Repository

### `depreciationRouter`

| Procedure | Type | Purpose |
|-----------|------|---------|
| `list` | protectedProcedure | All schedules + assets for a property |
| `getProjection` | protectedProcedure | Computed projections for FY range |
| `addAsset` | writeProcedure | Manual asset entry, auto-assigns pool type |
| `updateAsset` | writeProcedure | Edit asset, recalculates pool eligibility |
| `deleteAsset` | writeProcedure | Remove from schedule |
| `addCapitalWorks` | writeProcedure | Add Div 43 item |
| `updateCapitalWorks` | writeProcedure | Edit Div 43 item |
| `deleteCapitalWorks` | writeProcedure | Remove Div 43 item |
| `claimFY` | writeProcedure | Mark FY depreciation as claimed |
| `unclaimFY` | writeProcedure | Undo claim |
| `moveToPool` | writeProcedure | Move eligible asset to low-value pool |

Existing `extractDepreciation` and `saveDepreciationSchedule` stay in `taxOptimizationRouter`.

### `DepreciationRepository`

- Interface in `src/server/repositories/interfaces/`
- Implementation in `src/server/repositories/`
- Registered in UnitOfWork
- Methods: `findAssetsBySchedule()`, `findCapitalWorksByProperty()`, `createAsset()`, `updateAsset()`, `createClaim()`, `findClaimsByFY()`, etc.

## Testing Strategy

- **Pure calculation functions:** unit tests with known ATO examples (100% coverage on math)
- **Repository:** standard mock UoW tests
- **Router:** integration tests via tRPC caller
- **E2E:** add asset, view projection, mark as claimed flow

## Financial Year

- Hardcoded Australian FY (Jul 1 – Jun 30)
- FY integer convention: 2026 = FY2025-26 (year ending June 30)

## Out of Scope (follow-up)

- Tax reports page integration (existing tax position router can pull same data)
- Pre-Sep 1987 capital works (4% rate)
- Configurable FY start month
