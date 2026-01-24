# Anomaly Detection Design

**Date:** 2026-01-24
**Status:** Approved

## Overview

Anomaly detection identifies financial irregularities in property transactions: missed rent payments, unusual amounts, unexpected expenses, and duplicates. Alerts help users catch issues early and maintain accurate records.

---

## Data Model

```sql
anomaly_alerts
- id (uuid, pk)
- userId (uuid, fk → users)
- propertyId (uuid, nullable, fk → properties)
- alertType enum: missed_rent | unusual_amount | unexpected_expense | duplicate_transaction
- severity enum: info | warning | critical
- transactionId (uuid, nullable, fk → transactions)
- recurringId (uuid, nullable, fk → recurring_transactions)
- expectedTransactionId (uuid, nullable, fk → expected_transactions)
- description (text)
- suggestedAction (text)
- metadata (jsonb)
- status enum: active | dismissed | resolved
- dismissalCount (int, default 0)
- createdAt, dismissedAt, resolvedAt
```

**Key decisions:**
- Reuses `connectionAlerts` pattern for consistency
- Links to source transaction/recurring rule for context
- `metadata` stores detection details for UI display
- `dismissalCount` enables severity reduction after repeated dismissals

---

## Detection Rules

### Rule 1: Missed Rent (Critical)

- **Trigger:** Daily cron job
- **Logic:** `expected_transactions` with status `pending` where expected date + `alertDelayDays` has passed
- **Example:** "Rent of $2,400 expected on Jan 15 from 123 Main St has not been received"
- **Suggested action:** "Check with tenant or mark as skipped"

### Rule 2: Unusual Amount (Warning)

- **Trigger:** After bank sync, for each new transaction
- **Logic:** Compare to 6-month average for same merchant/description pattern, >30% deviation
- **Example:** "Water bill of $450 is 85% higher than usual ($243 avg)"
- **Suggested action:** "Review transaction or mark as expected"

### Rule 3: Unexpected Expense (Info)

- **Trigger:** After bank sync, for expense transactions
- **Logic:** Amount >$500 AND merchant not seen before on this property
- **Example:** "New expense of $1,200 from 'ABC Plumbing' on Investment Property 1"
- **Suggested action:** "Categorize and verify this transaction"

### Rule 4: Duplicate Transaction (Warning)

- **Trigger:** After bank sync, for each new transaction
- **Logic:** Same amount (±$0.01), same date (±1 day), similar description (fuzzy match)
- **Example:** "Possible duplicate: Two $150 transactions from 'Insurance Co' on Jan 10"
- **Suggested action:** "Review both transactions - dismiss if intentional"

---

## Integration Points

### After Bank Sync (immediate)

```
bankSync completes
  → For each new transaction:
      → Run: unusual_amount check
      → Run: unexpected_expense check
      → Run: duplicate_transaction check
  → Create anomaly alerts for any findings
```

Hook into existing `syncAccount` mutation in banking router. Process in same request.

### Daily Cron Job (missed rent)

```
Daily at 9am AEDT:
  → Query expected_transactions WHERE status = 'pending'
    AND expectedDate + alertDelayDays < today
  → For each: create missed_rent alert
  → Run matching logic to auto-resolve if transaction arrived
```

- Endpoint: `/api/cron/anomaly-detection`
- Triggered via Vercel Cron

### Auto-Resolution

- Transaction matches expected → resolve `missed_rent` alert
- User categorizes transaction → resolve `unexpected_expense` alert
- User verifies transaction → resolve `unusual_amount` alert

### Severity Learning

- Track dismissals per alert type + property + pattern
- After 3 dismissals of similar alerts: reduce severity
- Store learned thresholds in property settings

---

## Service Layer

### Anomaly Service (`/src/server/services/anomaly.ts`)

```typescript
// Core detection
detectUnusualAmount(transaction, historicalAvg) → AnomalyAlert | null
detectUnexpectedExpense(transaction, knownMerchants) → AnomalyAlert | null
detectDuplicates(transaction, recentTransactions) → AnomalyAlert | null
detectMissedRent(expectedTransaction) → AnomalyAlert | null

// Helpers
getHistoricalAverage(userId, merchantPattern, months: 6) → { avg, count }
getKnownMerchants(userId, propertyId) → Set<string>
calculateSimilarity(desc1, desc2) → number (0-1)

// Lifecycle
createAlert(alert) → void
resolveAlert(alertId, reason) → void
dismissAlert(alertId) → void
shouldReduceSeverity(userId, alertType, pattern) → boolean
```

### Anomaly Router (`/src/server/routers/anomaly.ts`)

```typescript
list          // Active alerts, ordered by severity then date
get           // Single alert with full context
dismiss       // Mark as dismissed, increment dismissal count
resolve       // Mark as resolved
bulkDismiss   // Dismiss multiple alerts
getSettings   // Per-property thresholds
updateSettings // Adjust thresholds
```

### Cron Endpoint (`/api/cron/anomaly-detection`)

```typescript
POST /api/cron/anomaly-detection
  - Verify cron secret header
  - Run missed rent detection for all users
  - Run auto-matching for pending expected transactions
  - Return: { checked, alertsCreated, resolved }
```

---

## UI Components

### Dashboard Alert Badge

- Bell icon in header with unread count (critical + warning)
- Red dot for critical, yellow for warning
- Click navigates to `/alerts`

### Alerts Page (`/alerts`)

- Filter tabs: All | Critical | Warning | Info | Dismissed
- Card per alert:
  - Severity indicator (color-coded left border)
  - Alert type icon
  - Description and property name
  - Timestamp
  - Action buttons
- Empty state: "No alerts - your portfolio looks healthy"

### Inline Transaction Alerts

- Warning icon next to flagged transactions in `/transactions`
- Tooltip shows alert description
- Click opens alert detail modal

### Alert Detail Modal

- Full description with context
- Unusual amount: comparison chart
- Duplicate: side-by-side transactions
- Actions: Dismiss, Create recurring rule, Mark as expected

### Settings (`/settings/alerts`)

- Toggle each alert type on/off
- Thresholds:
  - Unusual amount percentage (default 30%)
  - Unexpected expense minimum (default $500)
  - Alert delay days (default 3)

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `/src/server/db/schema.ts` | Add `anomalyAlerts` table |
| `/src/server/services/anomaly.ts` | Detection logic |
| `/src/server/routers/anomaly.ts` | TRPC router |
| `/src/app/api/cron/anomaly-detection/route.ts` | Daily cron |
| `/src/app/(dashboard)/alerts/page.tsx` | Alerts page |
| `/src/components/alerts/AlertCard.tsx` | Alert card component |
| `/src/components/alerts/AlertBadge.tsx` | Header badge |
| `/src/components/alerts/AlertDetailModal.tsx` | Detail modal |
| `/src/components/alerts/AlertSettings.tsx` | Settings form |

### Modified Files

| File | Change |
|------|--------|
| `/src/server/routers/_app.ts` | Register anomaly router |
| `/src/server/routers/banking.ts` | Hook detection after sync |
| `/src/components/layout/Header.tsx` | Add alert badge |
| `/src/app/(dashboard)/transactions/page.tsx` | Inline indicators |

---

## Migration

```sql
-- New enums
CREATE TYPE anomaly_alert_type AS ENUM (
  'missed_rent', 'unusual_amount', 'unexpected_expense', 'duplicate_transaction'
);
CREATE TYPE anomaly_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE anomaly_status AS ENUM ('active', 'dismissed', 'resolved');

-- New table
CREATE TABLE anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  alert_type anomaly_alert_type NOT NULL,
  severity anomaly_severity NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  recurring_id UUID REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  expected_transaction_id UUID REFERENCES expected_transactions(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  suggested_action TEXT,
  metadata JSONB DEFAULT '{}',
  status anomaly_status NOT NULL DEFAULT 'active',
  dismissal_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_anomaly_alerts_user_status ON anomaly_alerts(user_id, status);
CREATE INDEX idx_anomaly_alerts_property ON anomaly_alerts(property_id);
CREATE INDEX idx_anomaly_alerts_created ON anomaly_alerts(created_at DESC);
```

---

## No External Dependencies

All detection runs locally against existing data. No API costs or third-party integrations required.
