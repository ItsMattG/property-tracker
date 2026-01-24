# PropertyTracker v0.2 Roadmap Design

**Date:** 2026-01-24
**Status:** Approved

## Overview

V0.2 builds on the completed v0.1 foundation (properties, transactions, banking, loans, portfolio, reports, documents, recurring transactions, infrastructure) with four phases focused on financial intelligence, multi-user access, automation, and mobile.

---

## Phase 2.1: Valuations, Forecasting, Anomaly Detection, Notifications

### A1: Automated Property Valuations

**Data Model:**
```sql
propertyValuations
- id, propertyId
- source (manual | corelogic | proptrack)
- estimatedValue, confidenceLow, confidenceHigh
- valuationDate, apiResponseId
- createdAt
```

**Approach:**
- Integrate CoreLogic API as primary, PropTrack as fallback
- Store valuation history for equity tracking over time
- Auto-refresh monthly via cron job
- Manual override always available

**UI:**
- Property detail shows current valuation with confidence range
- "Last updated X days ago" with refresh button
- Valuation history chart on portfolio page

**Cost:** CoreLogic charges per lookup (~$5-15/property/month). Offer as premium feature or include limited lookups.

---

### A3: Cash Flow Forecasting

**Data Model:**
```sql
cashFlowForecasts
- id, userId, propertyId (nullable for portfolio-wide)
- forecastDate, forecastMonth
- projectedIncome, projectedExpenses, projectedNet
- assumptions (JSON: rent growth %, expense inflation %, vacancy rate)
- createdAt

forecastScenarios
- id, userId, name
- assumptions (JSON: interest rate change, rent adjustment, etc.)
- isDefault
- createdAt
```

**Approach:**
- Use trailing 12-month averages as baseline
- Factor in recurring transactions (known rent, loan repayments)
- Apply configurable assumptions (2% rent growth, 3% expense inflation default)
- Generate 12-month forward projection
- Scenario modeling: "What if interest rates rise 1%?"

**UI:**
- New `/reports/forecast` page
- Line chart showing projected cash flow by month
- Scenario dropdown to compare outcomes
- Summary cards: projected annual income, expenses, net position
- Highlight months where cash flow goes negative

---

### C3: Anomaly Detection

**Data Model:**
```sql
anomalyAlerts
- id, userId, propertyId (nullable)
- alertType (missed_rent | unusual_amount | unexpected_expense | duplicate_transaction)
- severity (info | warning | critical)
- transactionId (nullable), recurringId (nullable)
- description, suggestedAction
- status (active | dismissed | resolved)
- createdAt, resolvedAt
```

**Detection Rules:**

| Type | Logic | Severity |
|------|-------|----------|
| Missed rent | Expected recurring income not received within tolerance window | Critical |
| Unusual amount | Transaction >30% different from historical average for same merchant | Warning |
| Unexpected expense | Large expense (>$500) from new merchant on property account | Info |
| Duplicate | Same amount, date, description within 24 hours | Warning |

**Approach:**
- Run detection after each bank sync
- Background job daily for missed rent checks
- User can adjust thresholds per property
- Learn from dismissals (if user dismisses 3x, reduce severity)

**UI:**
- Alert badge on dashboard and sidebar
- `/alerts` page listing all active anomalies
- Inline alerts on transaction list
- One-click actions: "Mark as expected", "Create recurring rule", "Dismiss"

---

### D2: Push Notifications

**Data Model:**
```sql
notificationPreferences
- id, userId
- channel (email | push | both)
- rentReceived, syncFailed, anomalyDetected, weeklyDigest
- quietHoursStart, quietHoursEnd
- createdAt, updatedAt

notificationLog
- id, userId
- type (rent_received | sync_failed | anomaly | digest)
- channel, sentAt
- metadata (JSON: propertyId, amount, etc.)
```

**Notification Types:**

| Event | Default | Channel |
|-------|---------|---------|
| Rent received | On | Push + Email |
| Bank sync failed (24h+) | On | Email |
| Anomaly detected (critical) | On | Push |
| Anomaly detected (warning) | Off | Push |
| Weekly portfolio digest | On | Email (Sunday 9am) |

**Approach:**
- Web push notifications via Web Push API with service worker
- Email via existing provider (Resend/SendGrid)
- User controls all preferences in `/settings/notifications`
- Respect quiet hours (default 9pm-8am)

**UI:**
- Settings page with toggle matrix
- Browser permission prompt on first login
- Toast confirmation when notification sent
- Notification history in settings

---

## Phase 2.2: Multi-user, AI Categorization, Tax Optimization

### B1: Multi-user Access

**Approach:**
- Role-based access control: owner (full), partner (full except billing), accountant (read-only financials)
- Invite via email with accept/decline flow
- Accountants see financials only, no bank credentials or connection management
- Audit log for sensitive actions

**Data Model:**
```sql
userInvites
- id, userId, email, role, status (pending | accepted | declined), expiresAt

portfolioMembers
- id, portfolioId, userId, role, invitedBy, joinedAt
```

---

### C1: AI-Powered Categorization

**Approach:**
- Train model on user corrections (fine-tune on transaction descriptions)
- Start with rule-based + embeddings for merchant matching
- Confidence scoring: auto-apply >90%, flag <70% for review
- Batch suggestions: "5 transactions from Bunnings - categorize all as Repairs?"

**Data Model:**
```sql
categorizationModels
- id, userId, version, trainedAt, accuracy

merchantEmbeddings
- id, merchantName, embedding (vector), suggestedCategory
```

---

### A4: Tax Optimization Suggestions

**Approach:**
- Pre-EOFY suggestions based on deduction timing
- Examples: "Prepay $X interest to claim this FY", "Schedule repairs before June 30"
- Track depreciation remaining per asset
- Alert for commonly missed deductions

**UI:**
- Tax optimization section in `/reports/tax`
- Actionable cards with estimated savings
- Dismiss or mark as "done"

---

## Phase 2.3: Loan Comparison, Document Extraction, Property Manager APIs

### A2: Loan Comparison & Refinancing Alerts

**Approach:**
- Integrate rate comparison API (RateCity or Canstar)
- Compare current loan terms vs market rates
- Alert when potential savings >$100/month
- Refinance calculator with break costs consideration

**UI:**
- `/loans/compare` page
- Alert banner on loan detail when better rates available

---

### C2: Smart Document Extraction

**Approach:**
- Enhanced OCR pipeline for receipts and invoices
- Extract line items, dates, amounts, vendor names
- Auto-suggest transaction creation from extracted data
- Support: receipts, rate notices, insurance renewals, contractor invoices

**UI:**
- Upload document → extraction preview → confirm/edit → create transaction

---

### B2: Property Manager Integrations

**Approach:**
- OAuth integration with PropertyMe and :Different
- Auto-import: rent receipts, maintenance invoices, lease details
- Sync tenant information
- Two-way sync where APIs allow

**UI:**
- `/settings/integrations` page
- Connect/disconnect property manager accounts
- Mapping UI to link PM properties to PropertyTracker properties

---

## Phase 2.4: Native Mobile App

### D1: React Native Mobile App

**Approach:**
- React Native for iOS and Android
- Share business logic and API calls with web
- Core flows: dashboard, transaction review, push notifications
- Biometric authentication (Face ID, fingerprint)
- Offline transaction categorization with sync when online

**Features:**
- Dashboard with portfolio summary
- Transaction list with swipe-to-categorize
- Push notification handling
- Document capture via camera
- Property quick view

**Not in mobile v1:**
- Full report generation (link to web)
- Bank connection setup (security, link to web)
- Complex settings

---

## Implementation Order

| Phase | Features | Dependencies |
|-------|----------|--------------|
| **2.1** | Valuations, Forecasting, Anomaly Detection, Notifications | None |
| **2.2** | Multi-user, AI Categorization, Tax Optimization | 2.1 (anomaly detection groundwork) |
| **2.3** | Loan Comparison, Document Extraction, Property Manager APIs | 2.2 (multi-user for accountant access) |
| **2.4** | Native Mobile App | 2.1 (notifications), 2.2 (AI categorization) |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Valuation accuracy vs sold prices | Within 10% |
| Forecast accuracy (3-month lookback) | Within 15% |
| Anomaly detection precision | >80% (users don't dismiss) |
| Notification engagement | >50% open rate |
| AI categorization accuracy | >85% |
| Mobile app retention (30-day) | >40% |

---

## External Dependencies

| Feature | External Service | Cost Model |
|---------|------------------|------------|
| Valuations | CoreLogic / PropTrack | Per-lookup |
| Loan Comparison | RateCity / Canstar | API subscription |
| AI Categorization | OpenAI / Claude | Per-token |
| Push Notifications | Web Push (free) / FCM | Free |
| Property Managers | PropertyMe, :Different | Partner API (TBD) |
