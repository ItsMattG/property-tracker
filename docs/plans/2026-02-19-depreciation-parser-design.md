# Depreciation Schedule Parser Enhancement — Design

## Problem

The depreciation feature has a complete upload/extract/review pipeline but three critical gaps:

1. **Tax position disconnected** — uploaded schedules don't affect the tax calculator. Users see no impact on tax savings.
2. **AI deductions unvalidated** — Claude calculates yearly amounts but the service doesn't verify against ATO formulas. Editing cost/life/method doesn't recalculate.
3. **No multi-year tracking** — users see Year 1 deduction only. Can't see how diminishing value decreases over time.

## What Already Works

- Upload UI (`DepreciationUpload.tsx`): 3-step dialog (select property, upload PDF, review)
- Review table (`DepreciationTable.tsx`): read-only and editable modes
- Claude Haiku extraction (`depreciation-extract.ts`): Div 40 + Div 43 extraction
- Router CRUD (`taxOptimization.ts`): extract, save, list, delete — all complete
- MyTax integration: sums deductions correctly in EOFY report
- DB schema: `depreciationSchedules` + `depreciationAssets` tables with correct enums

## Approach

**Hybrid (Approach C)** — server-side ATO calculation service as source of truth, lightweight client-side preview for instant feedback during edits.

## Section 1: ATO Depreciation Calculation

### Server Service (`src/server/services/tax/depreciation-calc.ts`)

Source of truth for all ATO depreciation formulas. Pure functions, no DB access, fully unit-testable.

**Functions:**

| Function | Purpose |
|----------|---------|
| `calculateYearlyDeduction(originalCost, effectiveLife, method)` | Prime Cost: `cost / life`. Diminishing Value: `(cost × 2) / life`. Capped at remaining value. |
| `calculateRemainingValue(originalCost, effectiveLife, method, yearsElapsed)` | PC: `max(0, cost - deduction × years)`. DV: iterative annual application. |
| `generateMultiYearSchedule(originalCost, effectiveLife, method, years?)` | Returns `YearEntry[]`: `{ year, openingValue, deduction, closingValue }`. Stops at 0. |
| `validateAndRecalculate(assets)` | Replaces AI deductions with calculated ones. Flags >10% discrepancies. |

**ATO rules encoded:**

- Division 40 (Plant & Equipment): diminishing value rate = 200% ÷ effective life
- Division 43 (Capital Works): prime cost only, 2.5% for post-1987 buildings (40yr), 4% for post-2012 short-lived (25yr)
- Partial-year rule: first year prorated by `daysHeld / 365` using schedule's `effectiveDate`

### Client Preview (`src/lib/depreciation.ts`)

Lightweight subset for instant UI feedback during edits:

- `calculateYearlyDeduction(originalCost, effectiveLife, method)` — same formula as server
- Used in editable review table so deduction updates as user changes cost/life/method
- No multi-year schedule, no validation — preview only
- On save, server recalculates authoritatively and stored values replace preview

## Section 2: Tax Position Integration

### Router Changes (`taxPosition.ts`)

`getRentalResult` procedure gains a new step:
1. After summing transactions, query `depreciationSchedules` + `depreciationAssets` for the user's properties in the financial year
2. Sum all `yearlyDeduction` values across matching schedules
3. Return `totalDepreciation` as a separate field alongside existing rental result

**Schedule filtering:** Only schedules where `effectiveDate` falls within the financial year are included.

### Service Changes (`position.ts`)

- Add `depreciationDeductions` as optional input parameter
- Deduct from rental net result: `adjustedRentalNet = rentalNetResult - depreciationDeductions`
- No change to bracket/MLS/HECS logic — depreciation just reduces the rental income figure

### UI Impact

- Tax position summary shows a "Depreciation" line item in deductions breakdown
- Property savings calculation becomes more accurate (reflects actual tax benefit)

## Section 3: Multi-Year Depreciation Tracking

### New Router Procedure

`taxOptimization.getDepreciationProjection`:
- Input: `{ scheduleId: string, years?: number }` (defaults to effective life, capped at 40)
- Calls `generateMultiYearSchedule()` for each asset in the schedule
- Returns per-asset year-by-year breakdown + totals per year

### UI

Expandable section on the tax report's depreciation card:
- Each schedule gets a "View projection" toggle
- Expands to a table: Year | Total Deduction | Remaining Value
- Optional small line chart (Recharts) showing deduction curve
- Collapsed by default

**No schema changes** — projections calculated on-the-fly from stored asset data.

## Section 4: Extraction Validation & Client Preview

### Post-Extraction Validation (Server)

After Claude returns extracted assets, `validateAndRecalculate()` runs before returning to client:
- Each asset gets deduction recalculated using ATO formulas
- If AI deduction differs from calculated by >10%, asset flagged with `discrepancy: true`
- Client shows warning badge on flagged assets in review table

### Client Preview in DepreciationTable

- Import `calculateYearlyDeduction` from `@/lib/depreciation`
- When user changes cost, effective life, or method — instantly recalculate deduction column
- Real-time preview, no server round-trip
- On save, server recalculates authoritatively

### Division 43 Guardrail

- If category is `capital_works`, default effective life to 40 years and method to `prime_cost`
- Show hint: "Capital works are typically depreciated at 2.5% over 40 years"
- User can override

### No Extraction Prompt Changes

Claude's extraction is already good. Validation layer added after extraction, not by changing the prompt.

## Out of Scope

- Low-value pool immediate deduction (assets < $1,000)
- ATO effective life lookup table (specific lives per asset type)
- Depreciation schedule PDF generation/export
- Batch upload of multiple schedules
- Changes to the extraction prompt

## Technical Constraints

- Server calculation service must be pure functions (no DB, no side effects)
- Client preview must import only from `@/lib/` (no server imports)
- All chart colors use CSS variables
- Existing extraction service API unchanged (validation added as post-processing)
- `writeProcedure` for mutations, `protectedProcedure` for reads
