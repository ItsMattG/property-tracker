# Tax Optimization Suggestions Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

Tax optimization suggestions help property investors maximize deductions through timely alerts and actionable recommendations. Features include prepayment timing, expense scheduling, depreciation tracking via PDF upload, and missed deduction detection.

---

## Data Model

```sql
depreciationSchedules
- id (uuid, pk)
- propertyId (uuid, fk → properties)
- userId (uuid, fk → users)
- documentId (uuid, fk → documents, the uploaded QS report)
- effectiveDate (date, when schedule starts)
- totalValue (decimal, sum of all assets)
- createdAt (timestamp)

depreciationAssets
- id (uuid, pk)
- scheduleId (uuid, fk → depreciationSchedules)
- assetName (text, e.g., "Carpet - Bedroom 1")
- category (enum: plant_equipment | capital_works)
- originalCost (decimal)
- effectiveLife (decimal, years)
- method (enum: diminishing_value | prime_cost)
- yearlyDeduction (decimal, calculated)
- remainingValue (decimal)
- createdAt (timestamp)

taxSuggestions
- id (uuid, pk)
- userId (uuid, fk → users)
- propertyId (uuid, nullable, fk → properties)
- type (enum: prepay_interest | schedule_repairs | claim_depreciation | missed_deduction)
- title (text)
- description (text)
- estimatedSavings (decimal, nullable)
- actionUrl (text, nullable, deep link)
- financialYear (int)
- status (enum: active | dismissed | actioned)
- expiresAt (timestamp, for timing-based suggestions)
- createdAt (timestamp)
```

**Purpose:**
- `depreciationSchedules` links uploaded QS reports to properties
- `depreciationAssets` stores individual depreciable items extracted from PDF
- `taxSuggestions` stores generated suggestions with estimated savings

---

## Suggestion Generation Logic

**When suggestions are generated:**
- Daily cron job in May-June (EOFY season)
- On-demand when user views tax page
- After depreciation schedule upload

**Suggestion Types:**

| Type | Logic | Estimated Savings Calculation |
|------|-------|------------------------------|
| `prepay_interest` | If loan exists, calculate 1 month prepayment benefit | Prepay amount × marginal tax rate (assume 37%) |
| `schedule_repairs` | If <60 days to EOFY and no recent repairs, suggest | Based on avg annual repairs from history |
| `claim_depreciation` | If property has no depreciation schedule uploaded | Show typical first-year deduction ($5-15k) |
| `missed_deduction` | Scan categories with $0 that similar properties claim | Compare to common deductible categories |

**Missed Deduction Detection:**
- Compare user's claimed categories vs. common deductible categories
- Flag if user has 0 transactions for: insurance, council rates, water, property agent fees, land tax
- Only suggest if property owned >6 months in the FY

**Expiration:**
- Timing suggestions expire after EOFY (July 1)
- Depreciation suggestions persist until actioned

---

## Depreciation PDF Extraction

**Approach:**
- Upload PDF to Supabase storage (existing document flow)
- Read PDF content and send to Claude Haiku API
- Extract structured asset data as JSON
- Present for user review before saving

**Claude Prompt Strategy:**
```
You are extracting depreciation schedule data from an Australian
quantity surveyor report. Extract each depreciable asset as JSON.

For each asset return:
- assetName: description of the item
- category: "plant_equipment" or "capital_works"
- originalCost: dollar amount
- effectiveLife: years (number)
- method: "diminishing_value" or "prime_cost"
- yearlyDeduction: first year deduction amount

Return as JSON array. If uncertain about a field, use null.
```

**Error Handling:**
- If extraction fails, allow manual entry fallback
- Show confidence indicator on extracted data
- User can edit any field before confirming

**Cost Control:**
- Use Claude Haiku (fast, cheap)
- Cache extracted data - don't re-process same document
- Limit to 50 pages per document

---

## UI Design

### Tax Page Enhancement (`/reports/tax`)

**Suggestions Section (above report):**
- Cards showing each suggestion with:
  - Icon based on type (prepay, repairs, depreciation, missed)
  - Title and description
  - Estimated savings badge (if calculable)
  - Action button ("Upload Schedule", "View Transactions", etc.)
  - Dismiss button (with "Don't show again" option)

### Depreciation Upload Flow

1. Button: "Upload Depreciation Schedule"
2. File picker (PDF only)
3. Processing state: "Extracting assets from schedule..."
4. Review screen showing extracted assets in table
5. Edit any field if needed
6. Confirm to save

### Notifications

| Date | Notification |
|------|--------------|
| May 1 | "EOFY is approaching - review your tax optimization suggestions" |
| May 15 | Specific high-value suggestions (e.g., "Prepay $X interest to claim $Y this FY") |
| June 15 | Final reminder for any unactioned suggestions |

### Dashboard Widget

- Small card showing "X tax suggestions" with link to tax page
- Only shows in May-June (EOFY season)

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `/src/server/db/schema.ts` | Add 3 tables + enums |
| `/src/server/services/tax-optimization.ts` | Suggestion generation logic |
| `/src/server/services/depreciation-extract.ts` | Claude PDF extraction |
| `/src/server/routers/taxOptimization.ts` | API endpoints |
| `/src/components/tax/SuggestionCard.tsx` | Suggestion display |
| `/src/components/tax/DepreciationUpload.tsx` | Upload + review flow |
| `/src/components/tax/DepreciationTable.tsx` | Asset list display |
| `/src/app/api/cron/tax-suggestions/route.ts` | Daily suggestion generation |

### Modified Files

| File | Change |
|------|--------|
| `/src/app/(dashboard)/reports/tax/page.tsx` | Add suggestions section |
| `/src/server/routers/_app.ts` | Register router |
| `/src/server/services/notification.ts` | Add EOFY notification types |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Suggestion relevance (not dismissed) | >70% |
| Depreciation PDF extraction accuracy | >90% fields correct |
| User action rate on suggestions | >30% |
| EOFY notification open rate | >50% |
