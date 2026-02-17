# Personal Budget Tracker — Design Document

**Date:** 2026-02-17
**Beads task:** property-tracker-o0l
**Status:** Approved

## Context

BrickTrack is a property investment tracker. Adding personal budget tracking serves three goals:

1. **Full financial picture** — investors need to see personal spending alongside property data
2. **Daily engagement** — budgeting drives daily app opens vs checking property values monthly
3. **Borrowing power** — actual monthly expenses are a key input to borrowing capacity

### Competitor Research: TaxTank Money Tank

TaxTank's "Money Tank" validates demand for integrated property + budget tracking. Their approach: a "Tank" metaphor separating domains (Personal, Property, Work, Sole, Holdings) with budgets per category per month. Key learnings:

- **Strengths:** Tax-aware budgeting, bank feed automation, single dashboard, 50/30/20 support
- **Weaknesses:** Budgeting is a "bonus feature" not core product, no mobile app, limited documentation, complex modular pricing, basic variance analysis
- **BrickTrack opportunity:** Make budgeting first-class, better UX, deeper property integration, surplus-to-investment-capacity insight

Full analysis: see TaxTank research notes from 2026-02-17 session.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Standalone domain (Approach A) | Property and personal are different domains with different categories and reporting. Clean separation prevents "god table" |
| Budget model | Overall monthly target + optional per-category limits | Simple for casual users, granular for power users |
| Navigation | Dashboard widget + `/budget` page | Widget drives daily visibility, page provides depth |
| Bank routing | Account-level default type | Most users have "everyday" vs "investment" accounts — sensible defaults reduce manual work |
| Categories | 15 defaults with 50/30/20 grouping | Familiar framework, low friction setup |
| Plan gating | Free for all | Drives adoption and engagement on free tier |
| Migration | No existing data migration | Feature starts fresh — no risk to existing property data |

## Data Model

### `personal_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | text | FK → users |
| name | text | e.g. "Groceries" |
| group | enum: needs/wants/savings | Maps to 50/30/20. Nullable for uncategorized |
| icon | text | Lucide icon name |
| sortOrder | int | User-customizable ordering |
| createdAt | timestamp | |

Seeded defaults (per user on first budget setup):

**Needs:** Rent/Mortgage, Groceries, Utilities, Transport, Insurance, Health
**Wants:** Dining Out, Entertainment, Subscriptions, Clothing, Personal Care, Gifts
**Savings:** Savings, Debt Repayment, Education

### `personal_transactions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | text | FK → users |
| date | date | |
| description | text | |
| amount | numeric | Negative = expense, positive = income |
| personalCategoryId | uuid | FK → personal_categories. Nullable (uncategorized) |
| bankAccountId | uuid | FK → bank_accounts. Nullable (manual entry) |
| basiqTransactionId | text | Nullable. Prevents duplicate import |
| notes | text | Nullable |
| isRecurring | boolean | Default false |
| suggestedCategoryId | uuid | AI suggestion. Nullable |
| suggestionConfidence | int | 0-100. Nullable |
| createdAt | timestamp | |

### `budgets`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | text | FK → users |
| personalCategoryId | uuid | FK → personal_categories. Null = overall target |
| monthlyAmount | numeric | Budget amount in dollars |
| effectiveFrom | date | When this budget starts |
| effectiveTo | date | Nullable. Null = ongoing |
| createdAt | timestamp | |

### Schema Changes to Existing Tables

**`bank_accounts`** — add column:
- `defaultTransactionType: 'property' | 'personal' | 'ask'` (default: inferred from account type)

## Bank Transaction Routing

### Flow

```
Basiq sync → transaction arrives
    ↓
Check bank_account.defaultTransactionType
    ↓
┌─────────────┬──────────────┬─────────────┐
│ 'property'  │  'personal'  │    'ask'    │
│             │              │             │
│ Existing    │ New personal │ Review      │
│ pipeline    │ pipeline     │ queue       │
│ (property   │ (personal    │ (user       │
│ categories, │ categories,  │ classifies  │
│ AI, prop    │ personal AI) │ manually)   │
│ assignment) │              │             │
└─────────────┴──────────────┴─────────────┘
```

### Default Type Inference

- Transaction, Savings accounts → `'personal'`
- Mortgage, Offset, Line of Credit accounts → `'property'`
- Credit Card → `'ask'` (mixed use is common)

### Reclassification

Any transaction can be moved personal ↔ property. Implementation: delete from source table, create in target table. No dual-state.

## AI Categorization

Reuse existing categorization architecture with separate context:

- **Separate prompt** tuned for personal spending categories (not property/tax categories)
- **Separate merchant cache** (`personal_merchant_categories` table or namespace in existing)
- **Same two-tier strategy:** merchant memory → Claude Haiku fallback
- **Same confidence scoring:** 0-100, user corrections improve future suggestions

## UI Design

### Dashboard Widget — "Monthly Budget"

```
┌─────────────────────────────────────────┐
│ Budget — February 2026        ◄  ►      │
├─────────────────────────────────────────┤
│                                         │
│ $2,340 of $4,000            58%         │
│ ████████████████░░░░░░░░░░░░░           │
│                                         │
│ Groceries      $480 / $600   ████████░░ │
│ Dining Out     $180 / $200   █████████░ │
│ Transport      $120 / $150   ████████░░ │
│ Subscriptions  $95 / $100    █████████░ │
│ Entertainment  $85 / $150    █████░░░░░ │
│                                         │
│ +$1,660 remaining                       │
│                                         │
│ View full budget →                      │
└─────────────────────────────────────────┘
```

- Progress bar: green → amber at 80% → red at 100%
- Top 5 categories by spend amount
- Month navigation arrows

### `/budget` Page

**Two-panel layout:**

**Left: Budget Overview**
- Overall monthly target (editable inline)
- Category list with progress bars, sorted by % used descending
- Each row: icon | name | spent / budgeted | bar | %
- "Add category budget" button
- "Unbudgeted spending" section at bottom (categories with transactions but no budget)

**Right: Spending Activity** (context-sensitive)
- No selection: 6-month trend bar chart (total monthly spending)
- Category selected: that category's transaction list + trend chart
- Transaction rows: date, description, amount, bank account
- Click to expand with notes/edit

### Budget Setup Flow (First Time)

1. Dashboard widget shows "Set up your budget" CTA
2. Opens setup sheet:
   - "What's your monthly spending target?" — number input
   - "Set category limits?" — toggle (default off)
   - If yes: default categories with inputs, pre-filled via 50/30/20 split
3. Save → budget active, seeded categories created

### Editing

- Click any budget amount to edit inline
- No modals for simple edits
- Add/remove categories via budget page

## Borrowing Power Integration

### Exposed Query

`getAverageMonthlyExpenses(userId, months = 3)` — returns average total personal spending over the last N months. Consumed by the borrowing power feature (beads task `property-tracker-6t6`) when it's built.

### Surplus Insight

Budget page shows a callout:

> "You're spending $3,200/month on average. With income of $5,800/month, you could save **$31,200 toward your next property** in 12 months."

Light touch for V1 — text callout only. No goal tracking UI.

## Testing Strategy

### Unit Tests (Vitest)

- PersonalTransactionRepository: CRUD, filter by category/date, monthly aggregation
- BudgetRepository: CRUD, get budgets for month, calculate variance
- PersonalCategoryRepository: CRUD, seed defaults
- Transaction routing logic: account type → pipeline selection
- Personal categorization service: category matching, merchant cache
- Budget calculations: spend vs budget, surplus, progress percentages

### Integration Tests (Router-level)

- Budget CRUD through tRPC procedures
- Personal transaction creation with budget impact
- Reclassification flow (personal ↔ property)
- Bank sync routing to correct pipeline

### E2E Tests (Playwright)

- Budget setup flow from empty state
- Add category budget, verify progress bar updates
- Dashboard widget rendering
- Navigate dashboard widget → budget page

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No bank accounts connected | Budget page works with manual entry. Prompt to connect bank |
| No budgets set | Dashboard widget shows setup CTA. Budget page shows onboarding |
| Over budget | Amber at 80%, red at 100%. Visual only — no push notifications |
| Transactions without budget | Shown in "Unbudgeted spending" section |
| Category deleted with transactions | Transactions become uncategorized. Budget row removed |

## Security

- All queries scoped by `ctx.portfolio.ownerId`
- Mutations use `writeProcedure`
- No new public endpoints
- Personal financial data same security as property data

## Out of Scope (V1)

- Budget notifications/alerts (push, email)
- Recurring budget templates
- Goal tracking UI (savings goals, debt payoff)
- Budget sharing / joint budgets
- Weekly/quarterly budget periods
- Export/import budgets
- Mobile-specific budget UI
- Historical budget comparison (month over month)

These can be added in future iterations based on user feedback.
