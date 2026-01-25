# Property Manager Integrations Design

**Date:** 2026-01-25
**Status:** Approved
**Phase:** 2.3 (remaining)

## Goal

Integrate with property management software (starting with PropertyMe) to auto-import rent receipts, maintenance invoices, lease details, and reduce duplicate data entry for managed properties.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PropertyTracker                          │
├─────────────────────────────────────────────────────────────┤
│  PropertyManagerService (abstract interface)                │
│    ├── getProperties()                                      │
│    ├── getTenancies()                                       │
│    ├── getRentPayments()                                    │
│    ├── getMaintenanceJobs()                                 │
│    └── getBills()                                           │
├─────────────────────────────────────────────────────────────┤
│  PropertyMeProvider          │  FutureProvider              │
│  (implements interface)      │  (:Different, etc.)          │
├─────────────────────────────────────────────────────────────┤
│  PropertyManagerSyncService                                 │
│    - Pulls data from provider                               │
│    - Maps PM properties → PT properties                     │
│    - Creates/updates transactions                           │
│    - Handles deduplication                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key patterns:**
- Provider abstraction allows adding :Different later
- Sync service handles the mapping logic
- OAuth tokens stored securely per connection
- User maps PM properties to PropertyTracker properties once

## PropertyMe API

**Endpoints used:**
- `/v1/lots` - Properties
- `/v1/tenancies` + `/v1/tenancies/balances` - Leases and rent tracking
- `/v1/contacts/tenants` - Tenant info
- `/v1/jobtasks` - Maintenance jobs
- `/v1/bills` - Invoices
- `/v1/dashboards/transactions` - Financial data

**Authentication:** OAuth 2.0 with Bearer tokens
**Scopes:** property, activity, contact, transaction

## Database Schema

```sql
-- Store OAuth connections to property managers
CREATE TABLE property_manager_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL, -- 'propertyme', 'different', etc.
  provider_user_id TEXT, -- their user/agency ID
  access_token TEXT NOT NULL, -- encrypted
  refresh_token TEXT, -- encrypted
  token_expires_at TIMESTAMP,
  scopes TEXT[],
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'revoked'
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Map PM properties to PropertyTracker properties
CREATE TABLE property_manager_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES property_manager_connections(id),
  provider_property_id TEXT NOT NULL,
  provider_property_address TEXT,
  property_id UUID REFERENCES properties(id), -- nullable until mapped
  auto_sync BOOLEAN DEFAULT true,
  metadata JSONB, -- lease details, tenant info
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(connection_id, provider_property_id)
);

-- Track sync history and errors
CREATE TABLE property_manager_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES property_manager_connections(id),
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'manual'
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  items_synced INTEGER DEFAULT 0,
  transactions_created INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Add provider transaction ID to transactions table
ALTER TABLE transactions ADD COLUMN provider_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN provider TEXT; -- 'propertyme', etc.
```

## Sync Logic

**What gets synced:**

| PM Data | → | PropertyTracker |
|---------|---|-----------------|
| Rent payments | → | Transaction (income, category: rental_income) |
| Maintenance invoices | → | Transaction (expense, category: repairs_and_maintenance) |
| Bills (rates, insurance) | → | Transaction (expense, auto-categorized) |
| Lease details | → | Stored in mapping metadata |
| Tenant info | → | Stored in mapping metadata |

**Sync flow:**

1. User connects PropertyMe (OAuth)
2. Fetch their properties from /v1/lots
3. User maps PM properties → PT properties (UI)
4. Sync runs (manual or scheduled):
   - Fetch rent payments since last sync
   - Fetch maintenance jobs since last sync
   - Fetch bills since last sync
   - For each item:
     - Check if already imported (by providerTransactionId)
     - If new: create Transaction with status "confirmed"
     - Link to mapped property
   - Update lastSyncAt

**Deduplication:**
- Store `providerTransactionId` on transactions
- Check before creating, skip duplicates

**Frequency:**
- Manual sync button always available
- Auto-sync daily via cron

## UI Flow

### /settings/integrations

List all connected services:
- Property Managers (PropertyMe, :Different coming soon)
- Banking (Basiq)

### /settings/integrations/propertyme

Manage PropertyMe connection:
- Connection status
- Last sync time
- Property mappings (PM property → PT property dropdown)
- Sync Now / View History / Disconnect buttons

### OAuth Callback

`/api/integrations/propertyme/callback`
- Handle OAuth redirect
- Store tokens
- Redirect to mapping page

## Error Handling

| Scenario | Handling |
|----------|----------|
| Token expired | Auto-refresh, if fails mark "expired" and notify |
| API down | Retry 3x with backoff, mark sync failed |
| Property not mapped | Skip, show count in summary |
| Duplicate transaction | Skip silently |
| Rate limiting | Exponential backoff |
| Access revoked | Mark "revoked" on 401 |

## Testing

| Layer | Approach |
|-------|----------|
| Provider service | Unit tests with mocked HTTP |
| Sync service | Unit tests with mocked provider |
| OAuth flow | Integration test with mock server |
| Router | Standard tRPC tests |

## Future: Adding :Different

When :Different opens API access:
1. Create `DifferentProvider` implementing same interface
2. Add 'different' to provider enum
3. Add OAuth credentials for :Different
4. No changes to sync service or UI (just new provider option)
