# Recurring Transactions - Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Allow users to define expected recurring transactions (rent, loan repayments, insurance), auto-match them against bank imports, and receive alerts when expected transactions don't arrive.

**Architecture:** Two-table design separating templates from generated instances. Daily cron generates expected transactions, matching runs on bank sync. Confidence scoring determines auto-match vs manual review.

**Tech Stack:** Drizzle ORM, tRPC, Vercel Cron, email alerts (Resend/SendGrid).

---

## Data Model

### recurringTransactions table

```typescript
recurringTransactions = pgTable("recurring_transactions", {
  id: uuid().primaryKey(),
  userId: uuid().references(users.id).notNull(),
  propertyId: uuid().references(properties.id).notNull(),

  // Template details
  description: text().notNull(),
  amount: decimal(12, 2).notNull(),
  category: categoryEnum().notNull(),
  transactionType: transactionTypeEnum().notNull(),

  // Frequency
  frequency: frequencyEnum().notNull(), // weekly, fortnightly, monthly, quarterly, annually
  dayOfMonth: integer(), // 1-31, for monthly/quarterly/annually
  dayOfWeek: integer(), // 0-6, for weekly/fortnightly
  startDate: date().notNull(),
  endDate: date(), // nullable for ongoing

  // Matching config
  linkedBankAccountId: uuid().references(bankAccounts.id),
  amountTolerance: decimal(5, 2).default("5.00").notNull(), // percentage
  dateTolerance: integer().default(3).notNull(), // days
  alertDelayDays: integer().default(3).notNull(),

  isActive: boolean().default(true).notNull(),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
});
```

### expectedTransactions table

```typescript
expectedTransactions = pgTable("expected_transactions", {
  id: uuid().primaryKey(),
  recurringTransactionId: uuid().references(recurringTransactions.id).notNull(),
  userId: uuid().references(users.id).notNull(),
  propertyId: uuid().references(properties.id).notNull(),

  expectedDate: date().notNull(),
  expectedAmount: decimal(12, 2).notNull(),

  status: expectedStatusEnum().default("pending").notNull(), // pending, matched, missed, skipped
  matchedTransactionId: uuid().references(transactions.id),

  createdAt: timestamp().defaultNow(),
});
```

### Enums

```typescript
frequencyEnum = pgEnum("frequency", ["weekly", "fortnightly", "monthly", "quarterly", "annually"]);
expectedStatusEnum = pgEnum("expected_status", ["pending", "matched", "missed", "skipped"]);
```

---

## Generation & Matching Logic

### Generation (daily cron)

- Runs daily via Vercel Cron at 6am AEST
- For each active recurring template:
  - Calculate next expected dates for the next 14 days
  - Skip if expected transaction already exists for that date
  - Create with status `pending`

### Matching

Triggered on:
1. Bank sync completion
2. Expected transaction generation

**Match criteria:**
- Same property
- Same linked bank account (if specified)
- Amount within tolerance (±X%)
- Date within tolerance (±X days)

**Confidence scoring:**
- **High (auto-match):** Amount exact (within 1%), date within 2 days
- **Medium (flag for review):** Amount within 5%, date within 5 days
- **Low (no match):** Outside tolerances

**On match:**
- Set `matchedTransactionId` on expected transaction
- Update status to `matched`
- Auto-apply category/property/transactionType from template to bank transaction

**On miss (expectedDate + alertDelayDays passed, no match):**
- Update status to `missed`
- Create dashboard notification
- Queue email alert

---

## User Interface

### Creating Recurring Transactions

**Method 1: "Make recurring" button**
- Available on transaction row dropdown and transaction detail
- Opens modal pre-filled with transaction's amount, category, property, description
- User sets: frequency, day of month/week, tolerances (defaults provided), alert delay
- Creates recurring template, generates first expected transactions

**Method 2: Auto-suggestions banner**
- Pattern detection identifies 3+ similar transactions
- Show dismissible banner on transactions list: "We noticed monthly payments of ~$2,400 for Body Corporate. Create recurring?"
- Accept → opens pre-filled modal
- Dismiss → store in user preferences, don't suggest again

**Method 3: Prompt during categorization**
- When user categorizes a transaction matching a detected pattern
- Show inline prompt: "Set this up as recurring?"
- Quick yes/no action

### Reconciliation View

- New toggle on transactions page: `All | Needs Review | Reconciliation`
- Reconciliation view shows expected transactions grouped by status:
  - **Pending:** Expected but not yet due or within tolerance window
  - **Matched:** Successfully linked to actual transaction (show both)
  - **Missed:** Overdue with no match (highlighted red)
  - **Skipped:** Manually marked as "skip this period"

**Actions:**
- "Match manually" - Link expected to existing bank transaction
- "Mark as skipped" - Skip this instance without affecting template
- Click through to recurring template to edit

### Dashboard Notifications

- "Needs attention" card showing:
  - Count of missed expected transactions
  - Count of medium-confidence matches needing review
- Click through to reconciliation view filtered appropriately

---

## Email Alerts

**Trigger:** Expected transaction status changes to `missed`

**Email content:**
- Subject: "Expected transaction not received: [description]"
- Body:
  - Property name and address
  - Expected amount
  - Expected date
  - Days overdue
  - Link to reconciliation view

**Implementation:**
- Use Resend or existing email provider
- One email per missed transaction (not batched)
- Include unsubscribe/manage preferences link

---

## Pattern Detection Algorithm

**When:** Runs on transactions list load (cached, not real-time)

**Process:**
1. Group transactions by: category + property + amount bucket (±10%)
2. For each group with 3+ transactions:
   - Calculate intervals between consecutive transactions
   - Check if intervals cluster around known frequencies:
     - 7 days (weekly)
     - 14 days (fortnightly)
     - 28-31 days (monthly)
     - 89-92 days (quarterly)
     - 364-366 days (annually)
   - If consistent (±3 days variance), flag as pattern
3. Exclude transactions already linked to recurring templates
4. Store dismissed suggestions in user preferences

**Suggestion quality:**
- Minimum 3 occurrences required
- Show detected frequency and average amount
- Only suggest high-confidence patterns

---

## tRPC Router

### recurringRouter endpoints

```typescript
recurringRouter = router({
  // CRUD for recurring templates
  create: protectedProcedure.input(...).mutation(),
  update: protectedProcedure.input(...).mutation(),
  delete: protectedProcedure.input(...).mutation(),
  list: protectedProcedure.input(...).query(),
  get: protectedProcedure.input(...).query(),

  // Expected transaction actions
  skip: protectedProcedure.input({ expectedId }).mutation(),
  matchManually: protectedProcedure.input({ expectedId, transactionId }).mutation(),

  // Suggestions
  getSuggestions: protectedProcedure.query(),
  dismissSuggestion: protectedProcedure.input({ suggestionKey }).mutation(),

  // Reconciliation data
  getExpectedTransactions: protectedProcedure.input({ status?, propertyId? }).query(),
});
```

### Cron endpoint

`/api/cron/generate-expected`
- Protected by CRON_SECRET header
- Generates expected transactions for next 14 days
- Runs matching against recent unmatched bank transactions
- Updates missed statuses
- Queues email alerts

---

## Testing Strategy

### Unit tests (high priority)

1. **Matching logic**
   - Amount tolerance calculations (exact boundary, within, outside)
   - Date tolerance calculations
   - Confidence scoring
   - Multiple candidates (pick best match)

2. **Generation logic**
   - Each frequency type generates correct dates
   - Month-end edge cases (31st → 28th in Feb)
   - Don't duplicate existing expected transactions
   - Respects startDate and endDate

3. **Pattern detection**
   - Interval detection accuracy
   - Minimum occurrence threshold
   - Excludes already-linked templates
   - Handles irregular data gracefully

### Integration tests

- CRUD operations with ownership validation
- Manual matching updates both records correctly
- Skip doesn't affect template

### E2E tests

- Create recurring from transaction flow
- Reconciliation view shows correct data
- Accept suggestion creates template
