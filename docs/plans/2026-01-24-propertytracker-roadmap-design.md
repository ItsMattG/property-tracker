# PropertyTracker Roadmap Design

**Date:** 2026-01-24
**Status:** Approved

## Overview & Scope

This design covers four major workstreams:

1. **User-Facing Features** (5 components)
2. **Integration Refinement** (Basiq improvements)
3. **Polish & UX**
4. **Infrastructure**

---

## 1. User-Facing Features

### 1.1 Analytics & Reports

**Data Model Additions**

No new tables required. Reports aggregate existing `transactions`, `properties`, and `loans` data. Add a `reportSettings` JSON column to `users` table for saved report preferences (date ranges, property filters).

**Report Types**

1. **Tax Time Reports** (auto-detect format from property entity type)
   - **Individual Schedule**: Maps to ATO rental property schedule fields - gross rent, each deductible expense category, borrowing expenses, depreciation totals
   - **Trust/Company Format**: Income statement structure with distribution/dividend sections
   - Output: PDF for filing, Excel with formulas for accountant manipulation

2. **Portfolio Monitoring Dashboard**
   - Time selector: Monthly / Quarterly / Annual toggle
   - **Cash Flow Section**: Net income per property, expense ratio, cash-on-cash return
   - **Equity Section**: Estimated value (manual input), loan balance, LVR, equity position
   - **Yield Section**: Gross yield, net yield (requires property value input)
   - Trend charts showing month-over-month changes

3. **Accountant Export Package**
   - One-click generate: ZIP containing PDF summary + Excel transaction detail + category breakdown
   - Financial year selector (July-June for Australia)

**New Routes**
- `/reports` - Report hub with report type selection
- `/reports/tax/[year]` - Tax report generator
- `/reports/portfolio` - Portfolio monitoring dashboard

---

### 1.2 Capital Gains Tracking

**Data Model Additions**

```sql
capitalItems
- id, propertyId, type (improvement | acquisition_cost | selling_cost)
- description, amount, date
- createdAt, updatedAt

depreciationSchedules
- id, propertyId, source (manual | surveyor_import)
- importedAt, surveyorName, reportDate

depreciationItems
- id, scheduleId, category (div40_plant | div43_building)
- assetName, originalValue, effectiveLife, depreciationMethod (prime | diminishing)
- yearAcquired, annualDepreciation (JSON array of year -> amount)
```

**Features**

1. **Cost Base Tracking**
   - Record purchase price, stamp duty, legal fees, inspections (acquisition costs)
   - Track capital improvements with dates and amounts
   - Estimate selling costs (agent commission, legal, marketing)
   - Auto-calculate adjusted cost base: purchase + acquisition costs + improvements - depreciation claimed

2. **Depreciation Schedules**
   - Manual entry: Add items with effective life, method, calculate annual amounts
   - Surveyor import: Parse CSV/PDF from BMT, Washington Brown, MCG (common formats)
   - Track Division 40 (plant/equipment) and Division 43 (building) separately
   - Auto-sum annual depreciation for tax reports

3. **Sale Scenario Modeling**
   - Input hypothetical sale price and date
   - Calculate: capital gain, 50% discount eligibility (12+ months), CGT estimate at marginal rate
   - Timing advisor: "If you wait until [date], you qualify for 50% discount, saving $X"

**New Routes**
- `/properties/[id]/capital` - Cost base and depreciation management
- `/properties/[id]/capital/scenario` - Sale scenario calculator

---

### 1.3 Document Storage

**Data Model Additions**

```sql
documents
- id, userId, filename, mimeType, size, storagePath
- attachmentType (property | transaction)
- propertyId (nullable), transactionId (nullable)
- category (contract | receipt | inspection | depreciation | insurance | other)
- ocrStatus (pending | processing | completed | failed)
- ocrExtracted (JSON: { date, amount, vendor, confidence })
- createdAt, updatedAt
```

**Storage Architecture**

- Supabase Storage bucket: `documents/{userId}/{attachmentType}/{id}/{filename}`
- Max file size: 10MB
- Allowed types: PDF, PNG, JPG, JPEG, WEBP
- Signed URLs for secure access (expire after 1 hour)

**Features**

1. **Upload & Attach**
   - Drag-drop or click to upload on property detail page or transaction detail
   - Category selector on upload
   - Bulk upload support (multiple files at once)

2. **OCR Extraction** (receipts/invoices)
   - On upload, queue for OCR processing (use Supabase Edge Function + OCR API like Google Vision or AWS Textract)
   - Extract: date, total amount, vendor name
   - Present extracted values in confirmation dialog: "We found: $150.00 from Bunnings on 15/03/2025 - Apply to transaction?"
   - User confirms, corrects, or dismisses

3. **Document List Views**
   - Property documents tab showing all attached files
   - Transaction detail shows linked receipts
   - Global document search/filter by category, date range

**New Routes**
- `/api/documents/upload` - Handle file upload to Supabase Storage
- `/api/documents/ocr` - Trigger and retrieve OCR results

---

### 1.4 Recurring Transactions

**Data Model Additions**

```sql
recurringTransactions
- id, propertyId, userId
- description, amount, category, transactionType
- frequency (weekly | fortnightly | monthly | quarterly | annually)
- startDate, endDate (nullable for ongoing)
- dayOfMonth (for monthly), dayOfWeek (for weekly)
- tolerance (amount variance % for matching, default 5%)
- dateToleranceDays (default 3)
- isActive, lastGeneratedDate
- createdAt, updatedAt

pendingTransactions
- id, recurringId, propertyId
- expectedDate, expectedAmount, description, category
- status (pending | matched | unmatched | manual)
- matchedTransactionId (nullable)
- createdAt
```

**Features**

1. **Recurring Setup**
   - Create recurring transaction: "Rent from tenant - $2,400 monthly on 1st"
   - Support income (rent) and expenses (loan repayments, council rates, insurance, strata)
   - Set tolerance for matching: amount +/-5%, date +/-3 days (configurable)

2. **Auto-Generation**
   - Daily cron job (Vercel Cron or Supabase scheduled function)
   - Generate pending transactions for next 7 days
   - Mark as "expected" in transaction list with distinct styling

3. **Smart Matching**
   - When bank transactions sync, compare against pending transactions
   - Match criteria: property's linked account + amount within tolerance + date within range + description similarity
   - Auto-match high-confidence matches (>90%), flag medium confidence for review
   - Unmatched pending transactions after date range passes -> alert user

4. **Reconciliation View**
   - Show pending vs actual side-by-side
   - One-click confirm match, or manually link different transaction
   - Mark as "skipped this period" for missed payments

**New Routes**
- `/properties/[id]/recurring` - Manage recurring transactions for a property
- `/transactions?view=reconciliation` - Reconciliation view

---

### 1.5 Multi-property Portfolio View

**Data Model Additions**

```sql
propertyValues
- id, propertyId
- estimatedValue, valueDate, source (manual | api)
- notes
- createdAt
```

This tracks property value history for equity calculations and yield metrics.

**Features**

1. **Summary Cards View** (default)
   - Each property as a card showing:
     - Address, thumbnail (if document attached)
     - Current value, loan balance, equity, LVR
     - Monthly cash flow (income - expenses, trailing 3 months average)
     - Status indicators (uncategorized transactions, disconnected bank)
   - Sort by: cash flow, equity, LVR, alphabetical
   - Filter by: entity type, state

2. **Comparison Table View**
   - Side-by-side columns, one per property
   - Rows: purchase price, current value, capital growth, loan balance, equity, LVR, gross yield, net yield, monthly cash flow, annual expenses
   - Highlight best/worst performers per metric
   - Export table to CSV

3. **Aggregated Totals View**
   - Portfolio summary at top:
     - Total properties, total value, total debt, total equity, average LVR
     - Total monthly cash flow, total annual income, total annual expenses
   - Pie chart: equity distribution across properties
   - Bar chart: cash flow by property
   - Expandable property breakdown below

**New Routes**
- `/portfolio` - Main portfolio view with view toggle (cards | table | aggregate)
- `/properties/[id]/value` - Update property value estimate

**Navigation Update**
- Add "Portfolio" to sidebar above "Properties"

---

## 2. Integration Refinement (Basiq)

**Data Model Additions**

```sql
categorizationRules
- id, userId
- matchType (merchant | description_contains | description_regex)
- matchValue, category, transactionType
- propertyId (nullable - if set, only applies to this property)
- confidence (0-100, used for rule priority)
- createdAt, updatedAt

connectionAlerts
- id, userId, bankAccountId
- alertType (disconnected | requires_reauth | sync_failed)
- status (active | dismissed | resolved)
- emailSentAt (nullable)
- createdAt, resolvedAt
```

**Features**

1. **Connection Reliability**
   - Monitor connection status on each sync attempt
   - If connection fails: create alert record, show banner in dashboard
   - Email notification: send after 24 hours of failed connection (avoid spam for brief outages)
   - "Reconnect" button triggers Basiq re-auth flow
   - Connection health indicator on Banking page (green/yellow/red)

2. **Categorization Accuracy**
   - **Learned Rules**: When user categorizes, prompt "Apply to future transactions from [merchant]?" -> create rule
   - **Property Context**: Rules can be property-specific ("Rent from account X -> rental income for Property Y")
   - **Confidence Scoring**: Display confidence badge (High/Medium/Low) on auto-categorized transactions
   - Low confidence (<70%) transactions highlighted in review queue
   - Rule management UI: view, edit, delete learned rules

3. **On-Demand Sync**
   - "Sync Now" button on Banking page and transaction list
   - Rate limit: max 1 manual sync per 15 minutes per account
   - Show last sync timestamp and next scheduled sync

4. **Account Matching Improvements**
   - Improved linking UI with clear property dropdown and account purpose selector
   - Multi-property accounts: allocate transactions by percentage or flat amount split
   - Auto-suggestions: analyze transaction patterns, suggest "This account appears to receive rent for [address]"

**New Routes**
- `/settings/categorization-rules` - Manage learned rules
- `/api/banking/sync` - Manual sync trigger

---

## 3. Polish & UX

### 3.1 Onboarding

1. **First-Login Wizard**
   - Step 1: "Add your first property" - simplified property form
   - Step 2: "Connect your bank" - Basiq connection flow
   - Step 3: "Review transactions" - show first batch, explain categorization
   - Skip option at each step, can complete later

2. **Persistent Checklist**
   - Dashboard widget showing setup progress
   - Items: Add property, Connect bank, Categorize 10 transactions, Set up recurring, Add property value
   - Dismissible once all complete or user clicks "hide"

### 3.2 Mobile Responsiveness

- Collapsible sidebar -> hamburger menu on mobile
- Property/transaction cards stack vertically
- Tables -> card-based list view on small screens
- Touch-friendly tap targets (min 44px)
- Bottom navigation bar for key actions on mobile

### 3.3 Transaction Review Workflow

1. **Keyboard Shortcuts** (desktop)
   - Up/Down arrows navigate transactions
   - 1-9 assign category (show legend)
   - Enter confirm and move to next
   - Space toggle verified
   - ? show shortcut help

2. **Swipe Gestures** (mobile)
   - Swipe right -> mark as verified
   - Swipe left -> open category picker
   - Long press -> bulk select mode

3. **Batch Suggestions**
   - Group similar transactions: "5 transactions from 'Bunnings' - categorize all as Repairs & Maintenance?"
   - One-click apply to group

### 3.4 Navigation Improvements

- Consolidated sidebar: Portfolio, Properties, Transactions, Banking, Reports, Loans
- Global quick-add button (+ icon): Add property, Add transaction, Add loan
- Persistent property selector in header when viewing property-specific pages
- Breadcrumbs for deep navigation

---

## 4. Infrastructure

### 4.1 Testing Strategy

Priority order:

1. **Auth & Permissions** - Every API route must verify user owns the resource
   - Unit tests for permission checks in tRPC procedures
   - E2E tests attempting cross-tenant access (should fail)

2. **Financial Calculations** - Wrong numbers destroy trust
   - Unit tests for CGT calculations with edge cases (50% discount threshold, depreciation clawback)
   - Unit tests for tax report totals matching transaction sums
   - Snapshot tests for report generation

3. **Data Integrity**
   - Unit tests for CSV import parsing (various date formats, debit/credit columns)
   - Unit tests for recurring transaction matching logic
   - E2E tests for categorization rule application

### 4.2 CI/CD Pipeline

```
GitHub Actions workflow:
- On PR: lint -> type-check -> unit tests -> build -> E2E tests (against preview)
- On merge to main: deploy to production

Vercel setup:
- Production: main branch -> propertytracker.com
- Preview: PR branches -> pr-{number}.propertytracker.vercel.app
- Environment variables: separate for production/preview
```

### 4.3 Monitoring & Alerting

- **Sentry**: Error tracking with source maps, release tracking
- **Vercel Analytics**: Core Web Vitals, page load times
- **Uptime monitoring**: Simple ping service (BetterUptime or similar)
- **Custom business metrics** (log to Sentry or custom dashboard):
  - Failed bank syncs per day
  - Categorization override rate (how often users change auto-category)
  - Uncategorized transaction age

### 4.4 Performance Optimization

1. **Large Transaction Lists**
   - Server-side pagination (50 per page default)
   - Virtual scrolling for bulk review mode (react-virtual)
   - Indexed queries on propertyId, category, date

2. **Dashboard Load Time**
   - Cache stats queries (revalidate every 5 minutes or on transaction change)
   - Parallel data fetching with React Suspense boundaries

3. **Bank Sync Performance**
   - Batch insert transactions (bulk insert vs one-by-one)
   - Background job for large imports (>500 transactions)
   - Progress indicator for long-running syncs

---

## Implementation Order

Recommended sequence:

1. **Infrastructure first** - CI/CD, testing framework, monitoring (foundation for everything else)
2. **Analytics & Reports** - High user value, uses existing data
3. **Capital Gains Tracking** - New data models, complex calculations
4. **Document Storage** - New infrastructure (Supabase Storage, OCR)
5. **Recurring Transactions** - Depends on stable transaction system
6. **Multi-property Portfolio View** - Aggregates all other features
7. **Integration Refinement** - Iterative improvements
8. **Polish & UX** - Final layer of refinement
