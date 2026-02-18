# AI Document Scanner — Design

**Goal:** Full overhaul of document scanning: dedicated documents hub page, batch upload (up to 10 files), smarter extraction (GST, renewal dates, duplicate detection, confidence thresholds).

**Approach:** Incremental enhancement (Approach A) — build on existing Claude Sonnet vision extraction, Supabase storage, draft transaction workflow. No new AI models, no new schema migrations, no OCR pipeline.

---

## Documents Hub Page (`/documents`)

Top-level sidebar item (after Transactions, before Reports). Three sections:

1. **Upload zone** (top) — large drag-drop area accepting up to 10 files. Per-file progress cards: filename, thumbnail/icon, status (uploading → extracting → ready for review / confirmed / failed).

2. **Pending reviews** (middle) — completed extractions awaiting confirmation. Each row: vendor, amount, date, category, matched property, confidence badge. Click to expand inline `ExtractionReviewCard` (existing). "Confirm All" button for high-confidence (>=0.85) extractions.

3. **Document history** (bottom) — paginated table of all documents. Filters: property, category, date range, document type. Columns: filename, type badge, property, amount, date, status. Click row for details.

No folders, no search, no tags.

## Batch Upload Flow

New `BatchUploadZone` component (frontend-only orchestration):

- Accept up to 10 files per drop (JPG, PNG, HEIC, PDF, max 10MB each)
- Upload to Supabase in parallel (max 3 concurrent) via existing signed URL flow
- Each file's `documents.create` auto-triggers extraction (existing behavior)
- Poll each extraction via existing polling logic
- Per-file cards show: upload progress → extracting spinner → extracted preview (amount + category) or failure

**Quota:** Check remaining scans before batch. If batch exceeds quota, upload all files but only extract up to remaining. Show upgrade prompt for the rest.

No backend changes — existing `getUploadUrl` → upload → `documents.create` → auto-extract flow handles everything.

## Smarter Extraction

**Enhanced prompt** — Update Claude prompt in `document-extraction.ts` to also extract:
- `gstAmount` — GST component (common on AU receipts/invoices)
- `renewalDate` — for insurance policies, lease documents
- `policyNumber` / `referenceNumber` — for insurance, rates notices
- `abn` — vendor ABN (common on AU invoices)

Stored in existing `extractedData` JSON blob. No schema migration.

**Duplicate detection** — Before creating draft transaction, check for existing transaction with same amount + date (within 7 days) + vendor (fuzzy match). If found, store `duplicateOf: transactionId` in `extractedData`. Show warning badge in review: "Possible duplicate of [transaction]". Don't block — just warn.

**Confidence thresholds:**
- >= 0.85: eligible for bulk "Confirm All"
- < 0.85: manual review required
- < 0.50: warning badge "Low confidence — verify carefully"

## Navigation

- Sidebar item "Documents" with `FileText` icon, after Transactions, before Reports
- Badge showing pending review count (from `listPendingReviews`)
- Mobile: same position

## Edge Cases

- **No documents** → Empty state with upload CTA
- **Extraction fails** → Error card with "Retry" button
- **All files rejected** → Toast with validation errors
- **Mid-batch quota hit** → Upload all, extract up to quota, upgrade prompt for rest
- **Duplicate file** → Not blocked; duplicate transaction detection handles downstream

## Testing

- Unit tests: duplicate detection logic, confidence threshold bucketing
- No new E2E tests — manual staging verification

## What's NOT Changing

- No new DB tables or schema migrations
- No new AI models or OCR pipeline
- No email forwarding, folder system, full-text search
- `ExtractionReviewCard`, `DocumentList`, existing extraction service all reused
