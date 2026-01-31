# MyTax Report Export — Design Document

**Date:** 2026-01-28
**Phase:** 8.2 (TaxTank Features)
**Status:** Design approved

## Overview

Generate a pre-filled reference PDF mirroring ATO's MyTax rental property schedule (Item 21) plus personal income/deductions summary. Users review data via an interactive checklist, then export a PDF to take to their accountant or use alongside MyTax online.

**Not** an official ATO prefill file — a reference document. This avoids regulatory issues while being highly useful.

## Decisions

| Question | Decision |
|---|---|
| Export scope | Full tax return prefill (Item 21 + personal summary) |
| UX approach | Interactive checklist + PDF export |
| Year support | Any FY with transaction data |
| Navigation | `/reports/mytax` under Reports |

## Data Flow

1. User selects FY (any year with transaction data)
2. System aggregates transactions, tax profile, depreciation into MyTax-labelled sections
3. Interactive checklist lets user review each section, tick off items, add notes
4. Export generates PDF with ATO-aligned labels and amounts

### Data Sources

- **Transaction categories** → ATO labels (D1-D18 codes from `src/lib/categories.ts`)
- **Tax profile** → personal income, Medicare levy, HECS status (`taxProfiles` table)
- **Properties** → per-property rental income/expense breakdown (`reports.ts` router)
- **Depreciation** → capital works and plant/equipment (`depreciationSchedules` table)

## MyTax Sections & ATO Mapping

### Income (Item 21)

- Gross rent received → sum of `rental_income` transactions per property
- Other rental income → `other_income` transactions tagged to properties

### Deductions (Item 21, per property)

| MyTax Label | ATO Code | Source Category |
|---|---|---|
| Advertising | D1 | `advertising` |
| Body corporate fees | D2 | `body_corporate` |
| Borrowing expenses | D3 | `borrowing_expenses` |
| Council rates | D5 | `council_rates` |
| Insurance | D8 | `insurance` |
| Interest on loans | D9 | `loan_interest` |
| Land tax | D10 | `land_tax` |
| Legal expenses | D11 | `legal_fees` |
| Pest control | D12 | `pest_control` |
| Property agent fees | D13 | `property_management` |
| Repairs & maintenance | D14 | `repairs_maintenance` |
| Capital works deductions | D16 | `depreciationSchedules` (capital works) |
| Other expenses | D18 | remaining categories |

### Personal Sections (summary only)

- Salary/wages (from tax profile)
- Total net rental income/loss
- Medicare levy & surcharge
- HECS repayment (if applicable)
- Estimated tax position (using existing calculator)

## UI Design

### Page: `/reports/mytax`

**Top bar:** FY selector dropdown (shows all years with data) + "Export PDF" button.

**Main content: Checklist layout**

Collapsible sections matching MyTax structure:
- Section header with ATO label (e.g., "Item 21 — Rent on Australian Properties")
- Per-property subsections for deductions
- Each line: ATO label, calculated amount, transaction count
- Checkbox next to each line (user ticks as reviewed)
- Click line to expand contributing transactions
- Optional notes field per section

**Progress indicator:** "12 of 18 items reviewed" with progress bar.

**States:**
- Empty state if no transactions for selected FY
- Warning badges for $0 sections where data might be missing
- Info banner: "This is a reference document — not an official ATO submission. Consult your tax professional."

### PDF Export

- Cover page (FY, property summary, generation date)
- One page per property with Item 21 breakdown
- Summary page with personal income, net rental, estimated tax

## Implementation Scope

### New Files

- `src/app/(app)/reports/mytax/page.tsx` — main page with FY selector and checklist
- `src/components/reports/mytax/MyTaxChecklist.tsx` — checklist container
- `src/components/reports/mytax/MyTaxSection.tsx` — collapsible section
- `src/components/reports/mytax/MyTaxLineItem.tsx` — individual line with checkbox
- `src/components/reports/mytax/MyTaxProgressBar.tsx` — review progress
- `src/server/routers/mytax.ts` — tRPC router aggregating data
- `src/server/services/mytax.ts` — category-to-ATO mapping, report aggregation
- `src/server/services/mytax-pdf.ts` — PDF generation via jsPDF
- `src/lib/ato-codes.ts` — ATO code constants and mapping

### Modified Files

- `src/server/routers/index.ts` — register mytax router
- `src/app/(app)/reports/layout.tsx` or nav — add MyTax Export link
- `src/server/services/chat-system-prompt.ts` — add MyTax to navigation section

### Tests

- `src/server/services/__tests__/mytax.test.ts` — category mapping, aggregation, edge cases
- `src/server/services/__tests__/mytax-pdf.test.ts` — PDF generation structure
- `src/server/routers/__tests__/mytax.test.ts` — router integration

### No New Dependencies

Uses existing jsPDF, xlsx, and Drizzle infrastructure.

### No Database Changes

Reads from existing transactions, properties, taxProfiles, depreciationSchedules. Checklist state (ticked items, notes) stored in localStorage per FY.
