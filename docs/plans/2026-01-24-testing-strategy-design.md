# Testing Strategy (Phase 1)

**Date:** 2026-01-24
**Status:** Approved
**Scope:** Auth/Permission Tests + E2E Cross-Tenant Protection

## Overview

Add comprehensive auth/permission tests to high-risk routers and an E2E cross-tenant access test to verify data isolation works end-to-end.

---

## Test Infrastructure

### Shared Auth Test Helpers

Extend `src/server/__tests__/test-utils.ts` with reusable auth test patterns:

```typescript
// Auth test generator for router procedures
export function describeAuthTests(
  routerName: string,
  procedures: { name: string; input?: unknown }[]
)

// Data isolation test generator
export function describeDataIsolation(
  routerName: string,
  testCases: DataIsolationTestCase[]
)
```

### High-Risk Routers to Test

| Router | Risk Level | Reason |
|--------|------------|--------|
| `transaction` | High | Financial data, bulk operations |
| `banking` | High | External API, sensitive account data |
| `documents` | High | File access, storage paths |

Lower-risk routers (`stats`, `onboarding`, `portfolio`) already filter by userId but don't expose sensitive mutation paths - skip for now.

---

## Router Auth Tests

### Transaction Router (`transaction.test.ts`)

Test procedures for auth/isolation:
- `list` - Must filter by userId, never return other users' transactions
- `get` - Must verify ownership before returning
- `create` - Must set userId from context, not input
- `update` / `bulkUpdate` - Must only update user's own transactions
- `delete` - Must only delete user's own transactions
- `importCSV` - Must associate imported transactions with authenticated user

### Banking Router (`banking.test.ts`)

Test procedures:
- `listAccounts` - Only return user's connected accounts
- `syncAccount` - Verify user owns the account before syncing
- `listAlerts` / `dismissAlert` - Only access user's own alerts
- `reconnect` - Verify ownership before generating reconnect URL

### Documents Router (`documents.test.ts`)

Test procedures:
- `list` - Filter by userId
- `get` - Verify ownership (critical - prevents accessing other users' files)
- `create` - Associate with authenticated user
- `delete` - Only delete user's own documents
- Storage path validation - Ensure paths include userId segment

Each test file follows the pattern in `property.test.ts` - mock the database, verify the where clause includes userId.

---

## E2E Cross-Tenant Test

### Strategy

1. Seed database with "decoy" user and their data before test
2. Log in as real E2E test user
3. Attempt to access decoy user's resources via direct URLs
4. Verify all attempts fail or return empty results

### Test File

`e2e/cross-tenant-access.spec.ts`

### Seed Data

Created via direct database connection in test setup:
- Decoy user: `decoy-user-{timestamp}` with known UUID
- Decoy property: `decoy-property-{timestamp}`
- Decoy transaction linked to that property
- Decoy document record

### Test Cases

1. Navigate to `/properties/{decoy-property-id}` → Show "not found" or redirect
2. Navigate to `/transactions?propertyId={decoy-property-id}` → Show empty list
3. API call to `trpc.property.get({ id: decoy-id })` → Throw error
4. API call to `trpc.transaction.list({ propertyId: decoy-id })` → Return empty

### Cleanup

Delete decoy data after test completes.

---

## File Structure

```
src/server/__tests__/
  test-utils.ts              # Extend with auth test helpers

src/server/routers/__tests__/
  transaction.test.ts        # Add auth/isolation tests
  banking.test.ts            # New file - auth/isolation tests
  documents.test.ts          # Add auth/isolation tests

e2e/
  cross-tenant-access.spec.ts    # New E2E test
  helpers/
    seed-decoy-data.ts           # Database seeding helper
```

---

## Implementation Notes

### Test Database Access for E2E

Use existing Drizzle client from `src/server/db` in test setup for consistency.

### CI Integration

No changes needed to CI workflow - new tests picked up automatically:
- Unit tests: `npm run test:unit` (Vitest)
- E2E tests: `npm run test:e2e` (Playwright)

---

## Test Summary

| Category | Tests | Purpose |
|----------|-------|---------|
| Transaction router auth | ~8 tests | Verify userId filtering on all procedures |
| Banking router auth | ~6 tests | Verify account/alert ownership checks |
| Documents router auth | ~6 tests | Verify file access isolation |
| E2E cross-tenant | ~4 tests | Real-world protection verification |

## Out of Scope

- Auth tests for low-risk routers (`stats`, `onboarding`, `portfolio`)
- Additional CGT calculation tests (already well covered)
- Additional CSV import tests (already covered)
- Performance/load testing (separate concern)

## Success Criteria

- All new tests pass
- No router procedure accessible without authentication
- No user can access another user's resources via API or direct URL
- CI continues to pass
