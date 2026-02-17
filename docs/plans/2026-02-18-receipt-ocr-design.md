# Receipt OCR Enhancement — Design Document

**Date:** 2026-02-18
**Status:** Approved
**Approach:** Minimal Enhancement (Approach A)

---

## Summary

Improve the receipt scanning experience by adding a dedicated UI entry point, mobile camera capture, a receipts history page, and free-tier plan gating. The extraction backend already exists — this work is primarily UX and plan gating.

## Existing Infrastructure (No Changes Needed)

The following are already built and production-ready:

- **Document upload flow:** Supabase signed URLs, 10MB limit, JPEG/PNG/HEIC/PDF support
- **Extraction service:** Claude Vision API, structured extraction (vendor, amount, date, category, property address, line items, confidence)
- **Draft transaction flow:** Extraction creates `pending_review` transaction, user confirms or discards
- **Property auto-matching:** Extracted address matched to user's properties
- **ExtractionReviewCard component:** Form-based review with inline editing before confirm/discard
- **Review page:** `/transactions/review` shows pending extractions alongside category suggestions
- **Schema:** `documents` table (with `receipt` category), `documentExtractions` table (with status enum, extracted data JSON, draft transaction link)

## Architecture & Data Flow

No schema changes required. Existing tables cover the full flow.

```
User taps "Scan Receipt" (transactions page or /receipts page)
  → ReceiptScanner dialog opens (dropzone + capture="environment")
  → File selected → getUploadUrl → upload to Supabase → document.create
  → Auto-triggers extraction (existing fire-and-forget)
  → User sees "Processing..." state
  → Extraction completes → draft transaction created (pending_review)
  → User reviews in ExtractionReviewCard (inline on /receipts, or /transactions/review)
  → Confirm or Discard
```

## New Components & Pages

### ReceiptScanner (Dialog Component)

- Dropzone accepting JPEG/PNG/HEIC/PDF up to 10MB
- On mobile: `<input capture="environment">` triggers device camera directly
- Upload progress indicator
- Transitions to "Processing..." skeleton during extraction
- On completion: shows ExtractionReviewCard inline for immediate review
- Shows "X/5 scans used this month" for free tier users
- Shows upgrade CTA when monthly limit exhausted

### /receipts Page

- **Header:** "Receipts" title + "Scan Receipt" button (opens ReceiptScanner)
- **Pending reviews section:** Extraction cards needing confirmation (reuses ExtractionReviewCard)
- **History table:** All receipt-category documents with extraction status, date, vendor, amount, linked transaction

### Modified Existing Components

- **Transactions page header:** Add "Scan Receipt" button next to existing actions. Opens ReceiptScanner dialog.
- **Sidebar:** Add "Receipts" nav link with Receipt icon under Transactions section.

### Reused As-Is

- `ExtractionReviewCard` — confirm/edit/discard flow
- `getUploadUrl` / `document.create` — upload pipeline
- `confirmTransaction` / `discardExtraction` — review actions

## Plan Gating

- New repository method: `document.getMonthlyExtractionCount(userId)` — counts extractions created in current calendar month
- Check in `extract` procedure before creating extraction record
- **Free tier:** 5 extractions/month
- **Pro/Team/Lifetime:** Unlimited
- When limit reached: `FORBIDDEN` TRPCError with upgrade prompt
- Client-side: ReceiptScanner queries remaining count, shows counter for free users, replaces upload with upgrade CTA when exhausted
- No separate rate limiter — existing API rate limiter (100 req/min) covers burst abuse

## Model Upgrade

- Change extraction model from `claude-3-haiku-20240307` to `claude-sonnet-4-5-20250929`
- Same API shape, model string change only
- Better accuracy for: AU date formats, GST amounts, handwritten receipts, faded thermal paper
- Cost: ~$0.003-0.01 per extraction — negligible at 5 free/month per user
- No prompt changes needed

## Testing Strategy

**Unit tests:**
- `getMonthlyExtractionCount` repository method
- Plan gating in `extract` procedure (free at limit → FORBIDDEN, pro → passes)
- Receipt history query (filters to receipt-category documents)

**Component tests:**
- ReceiptScanner: dropzone rendering, camera input on mobile, processing state, limit counter, upgrade CTA
- /receipts page: pending reviews section, history table, scan button opens dialog

**No E2E tests for v1** — extraction depends on Supabase storage + Claude API.

**Estimated:** ~15-20 new tests across 3-4 test files.

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/documents/ReceiptScanner.tsx` | Upload dialog with camera capture |
| Create | `src/app/(dashboard)/receipts/page.tsx` | Receipts history + pending reviews page |
| Modify | `src/server/routers/documents/documentExtraction.ts` | Add plan gating to `extract` procedure |
| Modify | `src/server/repositories/document.repository.ts` | Add `getMonthlyExtractionCount` method |
| Modify | `src/server/repositories/interfaces/document.repository.interface.ts` | Add method to interface |
| Modify | `src/server/services/property-analysis/document-extraction.ts` | Swap model to claude-sonnet-4-5 |
| Modify | `src/app/(dashboard)/transactions/page.tsx` or parent | Add "Scan Receipt" button |
| Modify | `src/components/layout/Sidebar.tsx` | Add "Receipts" nav link |
| Create | `src/components/documents/__tests__/ReceiptScanner.test.tsx` | Component tests |
| Create | `src/server/routers/documents/__tests__/documentExtraction.test.ts` | Plan gating tests |

## Out of Scope (v1)

- Batch/multi-file upload
- Bulk confirm/discard
- In-browser camera viewfinder with edge detection
- Receipt thumbnail gallery with advanced filtering
- Pending count badge in sidebar
