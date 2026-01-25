# Smart Document Extraction Design

## Goal

Build an AI-powered document extraction system that automatically reads uploaded receipts, rate notices, insurance documents, and invoices, extracts structured data, and creates draft transactions for user review.

## Architecture

```
Document Upload → Storage (existing) → Extraction Queue
                                              ↓
                                    Claude Vision API
                                              ↓
                                    Extracted Data + Confidence
                                              ↓
                            Property Matching (fuzzy address match)
                                              ↓
                            Draft Transaction Created (status: pending_review)
                                              ↓
                                    Review UI → Confirm/Edit/Discard
```

**Key Components:**
1. **Extraction Service** - Sends document to Claude, parses structured response
2. **Property Matcher** - Fuzzy matches extracted addresses against user's properties
3. **Draft Transaction System** - Creates transactions in `pending_review` status
4. **Review UI** - Shows extraction results, allows edit before confirming

**Model:** Claude 3 Haiku for cost efficiency. Supports both images (JPEG/PNG) and PDFs.

## Database Schema

### documentExtractions

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| documentId | uuid | FK to documents |
| status | enum | `processing`, `completed`, `failed` |
| documentType | enum | `receipt`, `rate_notice`, `insurance`, `invoice`, `unknown` |
| extractedData | jsonb | Raw extraction result |
| confidence | decimal(3,2) | Overall confidence score 0-1 |
| matchedPropertyId | uuid | Auto-matched property (nullable) |
| propertyMatchConfidence | decimal(3,2) | Address match confidence 0-1 |
| draftTransactionId | uuid | FK to created draft transaction |
| error | text | Error message if failed |
| createdAt | timestamp | Extraction started |
| completedAt | timestamp | Extraction finished |

### transactions table modification

Add column: `status` enum (`confirmed`, `pending_review`)
- Existing transactions default to `confirmed`
- Extracted drafts start as `pending_review`

### extractedData JSON structure

```json
{
  "vendor": "Bunnings Warehouse",
  "amount": 245.50,
  "date": "2026-01-20",
  "dueDate": "2026-02-20",
  "category": "repairs_maintenance",
  "propertyAddress": "123 Smith St, Melbourne VIC 3000",
  "lineItems": [
    { "description": "Timber 90x45", "quantity": 10, "amount": 180.00 },
    { "description": "Screws 50pk", "quantity": 2, "amount": 65.50 }
  ],
  "rawText": "..."
}
```

## Extracted Fields by Document Type

| Field | Receipt | Rate Notice | Insurance | Invoice |
|-------|---------|-------------|-----------|---------|
| Vendor/Issuer | ✓ | ✓ | ✓ | ✓ |
| Amount | ✓ | ✓ | ✓ | ✓ |
| Date | ✓ | ✓ | ✓ | ✓ |
| Due Date | | ✓ | ✓ | ✓ |
| Category hint | ✓ | auto | auto | ✓ |
| Property address | | ✓ | ✓ | |
| Line items | | | | ✓ |

## Service Layer

### document-extraction.ts

```typescript
extractDocument(documentId: string): Promise<ExtractionResult>
detectDocumentType(content: string): DocumentType
parseExtractionResponse(response: string): ExtractedData
createDraftTransaction(extraction: ExtractionResult, userId: string): Promise<Transaction>
```

### property-matcher.ts

```typescript
matchPropertyByAddress(
  extractedAddress: string,
  userProperties: Property[]
): { propertyId: string | null; confidence: number }
```

## UI Flow

1. User uploads document (existing flow)
2. Toast: "Document uploaded. Extracting data..."
3. Background extraction runs (2-5 seconds)
4. Toast: "Extraction complete. Review draft transaction" with link
5. Badge appears on sidebar "Review" item

### Extraction Review Card

```
┌─────────────────────────────────────────────────────┐
│ receipt-bunnings-jan20.jpg                          │
│                                                     │
│ Document Type: Receipt (95% confident)              │
│                                                     │
│ Vendor:    [Bunnings Warehouse    ] ✓ extracted     │
│ Amount:    [$245.50              ] ✓ extracted     │
│ Date:      [2026-01-20           ] ✓ extracted     │
│ Category:  [Repairs & Maintenance ▼] suggested     │
│ Property:  [123 Smith St ▼        ] 92% match      │
│                                                     │
│ [View Document]  [Discard]  [Confirm Transaction]   │
└─────────────────────────────────────────────────────┘
```

### Property Match Confidence

- >90%: Auto-selected, green checkmark
- 50-90%: Auto-selected, yellow warning
- <50%: Not selected, user picks from dropdown

## Error Handling

| Scenario | Handling |
|----------|----------|
| Blurry/unreadable image | Mark failed, show "Image too blurry to read" |
| No amount found | Mark completed, don't create draft, prompt manual entry |
| Multiple amounts (invoice) | Use total, store line items in extractedData |
| Claude API timeout | Retry once, then mark failed with "Try again" button |
| Property match fails | Leave property unselected, user picks from dropdown |
| Duplicate extraction | Check if document already extracted, skip if so |

## Testing

- Unit tests for `parseExtractionResponse` with mock Claude responses
- Unit tests for `matchPropertyByAddress` fuzzy matching
- Unit tests for draft transaction creation
- Integration test: mock Claude API, verify full flow
- Test fixtures: sample receipt, rate notice, insurance, invoice JSON responses

## Cost

Claude Haiku: ~$0.25/1M input tokens
- Typical receipt image: ~1000 tokens
- 100 documents/month: ~$0.03
- Negligible cost, no rate limiting needed
