# Accountant Export Pack (EOFY) Enhancement — Design

## Problem

The accountant pack feature has a working PDF generation pipeline with 6 toggleable sections, but only 2 sections (Income & Expenses, Depreciation) are wired to real data. The remaining 4 sections (Capital Gains, Tax Position, Portfolio Overview, Loan Details) are fully rendered in the PDF but receive no data. Additionally, there's no Excel export, and the Income & Expenses section doesn't closely match the official ATO Rental Properties Schedule layout.

## What Already Works

- **Router** (`accountantPack.ts`): `generatePack`, `sendToAccountant`, `getSendHistory` — all complete
- **PDF generation** (`accountant-pack-pdf.ts`): 6 section renderers, cover page, footer, page management
- **Email delivery**: Resend integration with PDF attachment, send history tracking
- **UI page**: Financial year selector, 6 section toggles, download + email buttons, send history table
- **Data for 2 sections**: `buildTaxReportData()` for Income & Expenses, `buildMyTaxReport()` for Depreciation

## Approach

Client-side generation for both PDF and Excel (Approach A). Server provides data, client renders formats for downloads. Server generates both formats for email attachment.

## Section 1: Data Wiring (Router → PDF/Excel)

### New Procedure: `generatePackData`

Replace the current `generatePack` mutation (which generates PDF server-side) with a `generatePackData` query that returns raw data only:

- `protectedProcedure` (read-only)
- Input: `{ financialYear, sections }` (same schema)
- Fetches all enabled sections' data in parallel via `Promise.all()`
- Returns typed data object matching `AccountantPackConfig.data`

### Data Sources (all exist, no schema changes)

| Section | Data Source | Condition |
|---------|------------|-----------|
| Tax Position | Query tax profile + rental result, call `calculateTaxPosition()` | `sections.taxPosition` — renders "Profile incomplete" if no tax profile saved |
| Portfolio Overview | Query properties + latest property values + loans, compute equity/LVR | `sections.portfolioOverview` |
| Loan Details | Query loans joined with property addresses | `sections.loanDetails` |
| Capital Gains | Query `propertySales` for FY, join property addresses | `sections.capitalGains` — renders "No disposals" if no sales |

### `sendToAccountant` Changes

- Fetches same data as `generatePackData`
- Generates both PDF and Excel server-side
- Attaches both as email attachments
- Email template copy updated to mention "PDF and Excel attached"

## Section 2: ATO Format Improvements

### Income & Expenses Reformatting

Modify `addIncomeExpenses()` in the PDF renderer:

- Reorder deductions to follow ATO Rental Schedule item order (Interest D5, Council rates D6, etc.)
- Left-aligned ATO reference column instead of inline `[D5]` prefix
- Add per-property summary table at end: columns for Total Income | Total Deductions | Depreciation | Net Result
- Add portfolio totals row matching myTax Item 21 "Net rental income/loss" format

### Cover Page Enhancement

- Add "Prepared using BrickTrack — bricktrack.au" line
- Disclaimer text retained: "This is a reference document, not an official ATO submission"

## Section 3: Excel Export

### New File: `src/lib/accountant-pack-excel.ts`

Uses `exceljs` library (client-side, ~200kb gzipped). Same `AccountantPackConfig` input as PDF generator.

**Output:** `ArrayBuffer` downloaded as `.xlsx`

**Workbook structure (one sheet per enabled section):**

| Sheet | Content |
|-------|---------|
| Income & Expenses | Per-property rows with ATO ref, category, amount. Subtotals + grand totals. |
| Depreciation | Div 40 + Div 43 items per property with yearly deduction |
| Capital Gains | One row per sold property — dates, cost base, sale price, gain, discounted gain |
| Tax Position | Key-value layout — taxable income, levies, HECS, refund/owing, marginal rate |
| Portfolio Overview | One row per property — address, value, equity, LVR. Totals row. |
| Loan Details | One row per loan — property, lender, type, balance, rate, repayment. Totals row. |

**Styling:** Bold header rows with background fill, currency columns as `$#,##0.00`, percentage as `0.0%`, frozen header row, auto-width columns.

## Section 4: UI Changes

### Download Flow

1. Client calls `generatePackData` query (single server round-trip)
2. "Download PDF" button generates PDF client-side from returned data
3. "Download Excel" button generates Excel client-side from same data
4. Both buttons available simultaneously — no re-fetch needed

### Email Flow

1. `sendToAccountant` mutation generates both PDF + Excel server-side
2. Both attached to email automatically
3. No user format choice — both always included

### UI Layout

- "Download PDF" and "Download Excel" buttons side by side (replacing single "Download Preview")
- Rest of page unchanged (section toggles, email button, send history)

## Section 5: Out of Scope

- Custom branding/logo on PDF
- CSV export format
- Batch export for multiple financial years
- ABN on cover page (no ABN field in tax profile currently)
- Email template HTML redesign (copy update only)

## Technical Constraints

- `exceljs` added as dependency (dynamically imported on accountant-pack page only)
- PDF renderer functions modified in-place (no new PDF file)
- Excel generator is new file: `src/lib/accountant-pack-excel.ts`
- `generatePackData` is `protectedProcedure` (read-only)
- `sendToAccountant` stays `proProcedure`
- All data queries scoped by `ctx.portfolio.ownerId`
- No new DB tables or schema changes

## Testing

- Unit tests for `generatePackData` data assembly (mock UoW, verify all 6 sections populated correctly)
- Unit tests for Excel generator (sheet count, header rows, number formatting)
- Existing PDF tests updated for `addIncomeExpenses` reformatting changes
