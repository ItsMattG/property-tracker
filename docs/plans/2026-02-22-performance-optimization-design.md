# Performance Optimization Design

**Date:** 2026-02-22
**Approach:** Surgical fixes — HIGH items first (PR1), then MEDIUM items (PR2)

## Phase 1: HIGH Priority (PR1)

### H1. N+1 Transaction Insertions (Backend)
- **File:** `src/server/routers/banking/banking.ts:146-162`
- **Problem:** Inserts transactions one-by-one in loop (200+ queries per sync)
- **Fix:** Add `createMany()` to transaction repository, replace loop with batch insert
- **Also fix:** Silent error swallowing in catch block — check for unique constraint specifically

### H2. N+1 Property Manager Mappings (Backend)
- **File:** `src/server/routers/property/propertyManager.ts:53-65`
- **Problem:** Individual DB query per property to check mapping existence
- **Fix:** Batch query all mappings first, then bulk-create missing ones

### H3. CSV Export No Pagination (Backend)
- **File:** `src/server/routers/banking/transaction.ts:28-42`
- **Problem:** `exportCSV` loads all transactions into memory — OOM risk
- **Fix:** Add limit to export query (e.g., 50,000 rows max) with warning. Streaming export is P2.

### H4. DashboardClient Memoization (Frontend)
- **File:** `src/components/dashboard/DashboardClient.tsx` (517 lines)
- **Problem:** 6 queries, zero memoization, every sub-query re-renders entire tree
- **Fix:** Wrap child widgets (CashFlowWidget, BudgetWidget, etc.) in `React.memo`. Add `useCallback` for handlers passed to children.

### H5. Dashboard Double-Fetch (Frontend)
- **File:** `src/app/(dashboard)/dashboard/page.tsx:12` + `DashboardClient.tsx:117`
- **Problem:** Server prefetches `dashboardData`, client refetches same data
- **Fix:** Pass server-fetched `initialData` to the client query via props

### H6. Lazy-Load Heavy Libraries (Frontend)
- **Files:** Export utils importing jspdf (2MB), exceljs (4MB)
- **Problem:** Eagerly imported at module level
- **Fix:** Convert to dynamic `await import()` at point of use (export button click)

### H7. Email Table Indexes (Database)
- **File:** `src/server/db/schema/communication.ts`
- **Problem:** Missing composite indexes on `propertyEmails` (userId+propertyId, userId+isRead, userId+receivedAt)
- **Fix:** Add indexes via Drizzle schema, generate migration

## Phase 2: MEDIUM Priority (PR2)

### M1. Recharts Lazy Loading (Frontend)
- Dashboard chart widgets import Recharts (~450KB) eagerly
- Wrap chart components in `next/dynamic` with `{ ssr: false }`

### M2. Transactions keepPreviousData (Frontend)
- `src/app/(dashboard)/transactions/page.tsx:67`
- Add `placeholderData: keepPreviousData` to pagination query

### M3. React.memo on Chart/Widget Components (Frontend)
- Add `React.memo` to all chart components (CashFlowChart, EquityDonutChart, LvrGaugeCard, etc.)
- Move CustomTooltip definitions outside component scope

### M4. Memoize Callback Props (Frontend)
- Properties page `toggleEntity` and similar handlers — wrap in `useCallback`

### M5. Silent Error Handling Fix (Backend)
- `banking.ts:159-161` — check error code for unique constraint, re-throw others
- Add structured logging for skipped duplicates

### M6. Duplicate Subscription Fetches (Backend)
- Cache `findSubscriptionFull()` result in request context during auth middleware
- All procedures read from context instead of re-querying

### M7. CGT Filter Push-Down (Backend)
- `src/server/routers/property/cgt.ts` — add `categories` filter param to `findAllByOwner()`
- Push filtering to DB instead of loading all then filtering in-memory

### M8. syncAccount Decomposition (Backend)
- Break 250-line procedure into: `syncTransactions`, `detectAnomalies`, `categorizeTransactions`
- Each step independently testable and fail-safe

### M9. Property Manager Table Indexes (Database)
- Add indexes to `propertyManagerConnections` (userId, status)
- Add indexes to `propertyManagerMappings` (connectionId, propertyId)
- Add indexes to `propertyManagerSyncLogs` (connectionId, status)

### M10. Connection Idle Timeout (Database)
- `src/server/db/index.ts:13` — increase `idle_timeout` from 20 to 60 seconds

### M11. Recurring Transactions Composite Index (Database)
- Add `userId+isActive` composite index to `recurringTransactions`

### M12. findSenders Unbounded Query (Database)
- `email.repository.ts:205` — add `.limit(500)` to prevent memory spike

### M13. Raw SQL Cleanup (Database)
- `transaction.repository.ts:168` — replace raw SQL category filter with `ne()` operator

## Tech Notes
- React 19: `React.memo` still valid, no `forwardRef` needed
- tRPC v11: `keepPreviousData` → use `placeholderData: keepPreviousData` from `@tanstack/react-query`
- Drizzle: `ne()` from `drizzle-orm` for not-equal conditions
- Next.js dynamic: `dynamic(() => import(...), { ssr: false })` for chart lazy-loading
