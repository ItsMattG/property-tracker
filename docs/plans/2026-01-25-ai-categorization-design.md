# AI-Powered Categorization Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

AI-powered transaction categorization using Claude API. Automatically suggests categories for new transactions during bank sync, learns from user corrections, and provides a review interface for batch processing.

---

## Data Model

```sql
merchantCategories
- id (uuid, pk)
- userId (uuid, fk → users)
- merchantName (text) -- normalized merchant name
- category (category enum)
- confidence (decimal) -- running average
- usageCount (int) -- times this mapping was used
- lastUsedAt (timestamp)
- createdAt

categorizationExamples
- id (uuid, pk)
- userId (uuid, fk → users)
- description (text) -- original transaction description
- category (category enum)
- wasCorrection (boolean) -- true if user changed AI suggestion
- createdAt
```

**Purpose:**
- `merchantCategories` stores learned merchant → category mappings (e.g., "Bunnings" → repairs)
- `categorizationExamples` stores user corrections to include in Claude prompts as few-shot examples
- Both are per-user so each portfolio learns independently

**Transaction table additions:**
- `suggestedCategory` (category enum, nullable)
- `suggestionConfidence` (decimal, nullable)
- `suggestionStatus` (enum: pending | accepted | rejected, nullable)

---

## Categorization Flow

1. **Bank sync triggers categorization** - When new transactions sync, process each for category suggestion

2. **Check merchant memory first** - Look up `merchantCategories` for normalized merchant name. If found with >80% confidence, use directly without API call

3. **Call Claude API** - For unknown merchants or low confidence:
   - Send transaction description and amount
   - Include valid category list with descriptions
   - Include up to 10 recent corrections from `categorizationExamples`
   - Request JSON response with category and confidence

4. **Store suggestion** - Save `suggestedCategory`, `suggestionConfidence`, set `suggestionStatus` to "pending"

5. **User reviews** - On `/transactions/review` page, user sees suggestions with color-coded confidence

6. **Learn from feedback:**
   - Accept: Update `merchantCategories`, apply category to transaction
   - Reject: Store correction in `categorizationExamples`, update merchant mapping

---

## UI Design

### Transaction Review Page (`/transactions/review`)

**Layout:**
- Header: "Review Suggestions" with pending count badge
- Filter tabs: All | High Confidence | Low Confidence
- Transactions grouped by merchant when multiple from same source

**Suggestion Card:**
- Transaction date, description, amount
- Suggested category with confidence indicator:
  - Green dot: >85% confidence
  - Yellow dot: 60-85% confidence
  - Red dot: <60% confidence
- Accept button (checkmark)
- Dropdown to select different category

**Batch Actions:**
- Grouped card when 2+ transactions from same merchant
- "Apply to all X" button for one-click batch categorization
- Individual override available within group

**Navigation:**
- Badge on Transactions nav showing pending review count
- Link to review page from transaction list

---

## Claude API Integration

### Service Interface

```typescript
interface CategorizationResult {
  category: Category;
  confidence: number; // 0-100
  reasoning?: string;
}

async function categorizeTransaction(
  description: string,
  amount: number,
  recentExamples: Example[]
): Promise<CategorizationResult>
```

### Prompt Strategy

- System prompt: Australian property investor transaction categorizer
- Include category list with brief descriptions
- Include 5-10 recent user corrections as few-shot examples
- Request structured JSON response

### Cost Control

- Use Claude Haiku (fast, low cost)
- Skip API if merchant known with >80% confidence
- Batch up to 10 transactions per API call
- Cache merchant lookups

### Error Handling

- API failure: Leave as "uncategorized", don't block sync
- Retry once with exponential backoff
- Log failures for monitoring

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `/src/server/db/schema.ts` | Add tables and transaction fields |
| `/src/server/services/categorization.ts` | Claude API, merchant lookup, learning |
| `/src/server/routers/categorization.ts` | API endpoints |
| `/src/app/(dashboard)/transactions/review/page.tsx` | Review page |
| `/src/components/categorization/SuggestionCard.tsx` | Individual suggestion |
| `/src/components/categorization/BatchSuggestionCard.tsx` | Grouped suggestions |
| `/src/components/categorization/ConfidenceBadge.tsx` | Confidence indicator |

### Modified Files

| File | Change |
|------|--------|
| `/src/server/routers/transaction.ts` | Add suggestion fields |
| `/src/server/services/sync.ts` | Trigger categorization after sync |
| `/src/server/routers/_app.ts` | Register router |
| `/src/components/layout/Sidebar.tsx` | Add review link with badge |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Categorization accuracy (user accepts) | >85% |
| API calls saved by merchant memory | >50% after 30 days |
| Average confidence score | >75% |
| Time to review (per transaction) | <3 seconds |
