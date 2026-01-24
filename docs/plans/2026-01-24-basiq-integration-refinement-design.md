# Basiq Integration Refinement Design

**Date:** 2026-01-24
**Status:** Approved
**Scope:** Connection Reliability + On-Demand Sync (Phase 1)

## Overview

Improve Basiq bank integration with connection health monitoring, alerts, email notifications, and manual sync controls. Categorization rules and account matching improvements deferred to Phase 2.

---

## Data Model

### New Table: connectionAlerts

```sql
connectionAlerts
- id: uuid primary key
- userId: uuid references users(id)
- bankAccountId: uuid references bankAccounts(id)
- alertType: enum (disconnected | requires_reauth | sync_failed)
- status: enum (active | dismissed | resolved)
- errorMessage: text nullable
- emailSentAt: timestamp nullable
- createdAt: timestamp
- dismissedAt: timestamp nullable
- resolvedAt: timestamp nullable
```

Tracks alert history and supports 24-hour email delay logic.

### Modified Table: bankAccounts

Add columns:

```sql
- connectionStatus: enum (connected | disconnected | error) default 'connected'
- lastSyncStatus: enum (success | failed | pending) nullable
- lastSyncError: text nullable
- lastManualSyncAt: timestamp nullable
```

Provides quick access to current status without querying alerts table.

---

## Sync Flow

### On-Demand Sync

1. User clicks "Sync Now" on a bank account
2. Server checks `lastManualSyncAt` - if within 15 minutes, return error with `retryAfter` timestamp
3. Update `lastManualSyncAt` and set `lastSyncStatus = 'pending'`
4. Call Basiq API to refresh connection and fetch new transactions
5. On success:
   - Set `connectionStatus = 'connected'`, `lastSyncStatus = 'success'`
   - Resolve any active alerts for this account
6. On failure:
   - Set `connectionStatus` based on error type, `lastSyncStatus = 'failed'`
   - Store error in `lastSyncError`
   - Create `connectionAlert` if none exists for this error type

### Rate Limit Response

```typescript
{
  allowed: false,
  retryAfter: "2026-01-24T10:30:00Z",
  message: "Please wait 12 minutes before syncing again"
}
```

### Connection Monitoring

When syncs occur (manual or scheduled), apply same success/failure logic:
- Create alert on failure if none exists
- Resolve alerts on success
- Edge Function sends email if alert persists 24+ hours

---

## API Routes

### tRPC Procedures (banking router)

**banking.syncAccount**
- Input: `{ accountId: string }`
- Checks rate limit, triggers Basiq sync
- Returns: `{ success: boolean, transactionsAdded: number }` or rate limit error

**banking.getConnectionStatus**
- Returns all accounts with `connectionStatus`, `lastSyncStatus`, `lastSyncedAt`
- Includes active alert count per account

**banking.listAlerts**
- Returns active `connectionAlerts` for user
- Used by dashboard banner and banking page

**banking.dismissAlert**
- Input: `{ alertId: string }`
- Sets `status = 'dismissed'`, `dismissedAt = now()`

**banking.reconnect**
- Input: `{ accountId: string }`
- Generates new Basiq auth link for re-authentication
- Returns auth URL for redirect

### Supabase Edge Function

**send-connection-alerts** (scheduled daily via cron)

1. Query alerts where:
   - `status = 'active'`
   - `emailSentAt IS NULL`
   - `createdAt < now() - 24 hours`
2. Group by user, send single email per user listing all affected accounts
3. Update `emailSentAt` on processed alerts

---

## UI Components

### Dashboard Banner

- Appears at top of dashboard when active alerts exist
- Content: "1 bank connection needs attention" with link to /banking
- Dismissible (dismisses current alerts, not future)
- Styling: yellow/warning for disconnected, red/error for auth failures

### Banking Page

**Account Cards:**
- Status indicator: green dot (connected), yellow (issue), red (failed)
- "Last synced: 2 hours ago" timestamp
- "Sync Now" button with rate limit handling
- "Reconnect" button when `status = requires_reauth`

**Alert Section:**
- Banner at top when active alerts exist
- Expandable details: error message, created time, dismiss button

**Sync Button States:**
1. Ready: "Sync Now" - primary style
2. Syncing: "Syncing..." with spinner, disabled
3. Rate limited: "Sync available in 12m" - muted, disabled
4. Success: Brief "Synced!" then returns to ready

---

## Testing

### Unit Tests (Vitest)

- Rate limiting: 15-minute window enforced correctly
- Alert creation on sync failure
- Alert resolution on sync success
- `retryAfter` timestamp calculation
- Dismiss doesn't affect future alerts

### Integration Tests

- Mock Basiq responses: success, auth failure, connection error
- Verify correct `connectionStatus` and `alertType` per error type
- Email queue picks up 24h+ alerts, updates `emailSentAt`

### Edge Function Tests

- Batch logic: multiple alerts → single email per user
- Skips alerts with existing `emailSentAt`
- Handles empty result set

### Manual Testing

- Trigger rate limit, verify countdown
- Simulate connection failure, verify dashboard banner
- Reconnect flow generates valid auth link

---

## Implementation Notes

- Basiq error types map to alertType:
  - 401/403 → `requires_reauth`
  - Connection timeout → `disconnected`
  - Other errors → `sync_failed`
- Email template should include: account name, institution, error type, reconnect link
- Consider batching transaction inserts for large syncs (>100 transactions)

---

## Future Work (Phase 2)

- Categorization rules with learned patterns
- Confidence scoring for auto-categorization
- Multi-property account allocation
- Account matching suggestions
