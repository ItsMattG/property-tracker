# Dashboard DISTINCT ON Regression Test Design

**Date:** 2026-02-14
**Beads:** 1x9
**Status:** Draft

## Problem

`dashboard.getInitialData` had a production 500 due to incorrect `ANY` parameter binding in a raw SQL `DISTINCT ON` query. The trends section uses `selectDistinctOn` to get the latest property value per property for portfolio value/equity calculations. There is zero test coverage for this router.

## Solution

Three-part approach:

1. **Refactor:** Extract dashboard's DISTINCT ON logic to reuse portfolio's existing `getLatestPropertyValues` helper
2. **Unit tests:** Router-level tests with mocked DB for calculation logic
3. **Integration tests:** Real-DB tests validating actual SQL execution

## Part 1: Refactor — Shared Helper

Portfolio.ts already has `getLatestPropertyValues(db, userId, propertyIds)` returning `Map<string, number>`.

Dashboard needs two variants:
- **Current:** Latest value per property (identical to portfolio's helper)
- **Previous:** Latest value per property *before* a cutoff date

**Change:** Add optional `beforeDate?: string` parameter to `getLatestPropertyValues`. When provided, adds `lt(propertyValues.valueDate, beforeDate)` to the where clause.

Then dashboard.ts replaces its inline `selectDistinctOn` calls (lines 218-234, 247-264) with:
```ts
const currentValues = await getLatestPropertyValues(ctx.db, userId, activePropertyIds);
const prevValues = await getLatestPropertyValues(ctx.db, userId, activePropertyIds, currentMonthStr);
```

**File:** `src/server/routers/portfolio.ts` — export `getLatestPropertyValues`, add `beforeDate` param
**File:** `src/server/routers/dashboard.ts` — import and use the helper

## Part 2: Unit Tests

**File:** `src/server/routers/__tests__/dashboard.test.ts`

Uses `createMockContext` + `createTestCaller` pattern from `test-utils.ts`. Mocks all parallel queries in `getInitialData`.

### Test Cases

1. **Returns correct portfolio value from DISTINCT ON results** — 2 properties with valuations, asserts `trends.portfolioValue.current` = sum of latest valuations
2. **Falls back to purchasePrice when no valuation** — 1 property with valuation, 1 without; asserts fallback works
3. **Returns null previous when all properties created this month** — asserts `trends.portfolioValue.previous` is null
4. **Calculates equity correctly** — portfolio value minus loan debt
5. **Handles empty property list** — no selectDistinctOn call, values are 0
6. **Previous value respects date filter** — mock returns different data for current vs previous calls

## Part 3: Integration Tests

**File:** `src/server/routers/__tests__/dashboard.integration.test.ts`

Real Drizzle DB connection using `DATABASE_URL` env var. Transaction-based cleanup (begin → test → rollback).

### Setup/Teardown

```ts
beforeAll(async () => {
  db = drizzle(postgres(process.env.DATABASE_URL!));
});

beforeEach(async () => {
  // Insert test user, properties, property_values, loans
});

afterEach(async () => {
  // Delete test data by userId
});

afterAll(async () => {
  await sql.end();
});
```

### Test Cases

1. **DISTINCT ON returns only latest value per property** — Insert 3 property values per property with different dates, verify helper returns only the latest
2. **Multiple properties with inArray binding** — Insert 3+ properties, verify the query doesn't error (regression for the `ANY` binding bug)
3. **Date-filtered DISTINCT ON** — Insert values spanning months, verify `beforeDate` filter returns correct prior valuation
4. **No property values** — Returns empty map, no error

### CI Considerations

Integration tests require a running PostgreSQL instance. They should:
- Be in a separate file (`.integration.test.ts`) so they can be run/skipped independently
- Check for `DATABASE_URL` and skip if not available: `describe.skipIf(!process.env.DATABASE_URL)`

## Tech Notes (context7)

- **Drizzle `selectDistinctOn`:** `db.selectDistinctOn([col], { ... }).from(table).where(...).orderBy(...)` — the `orderBy` must start with the DISTINCT ON column(s)
- **Vitest lifecycle:** `beforeAll`/`afterAll` for DB connection, `beforeEach`/`afterEach` for data setup/cleanup. Can return async cleanup functions from `beforeAll`.

## Test Scenarios Summary

| # | Type | Scenario | Validates |
|---|------|----------|-----------|
| 1 | Unit | Correct portfolio value | DISTINCT ON mock → sum calculation |
| 2 | Unit | PurchasePrice fallback | Missing valuation handling |
| 3 | Unit | Null previous (new properties) | Edge case for month comparison |
| 4 | Unit | Equity calculation | Value - debt math |
| 5 | Unit | Empty properties | Guard clause, no DB call |
| 6 | Unit | Previous date filter | Two separate mock calls |
| 7 | Integration | Latest value only | Real DISTINCT ON ordering |
| 8 | Integration | Multi-property inArray | ANY binding regression |
| 9 | Integration | Date-filtered query | beforeDate parameter |
| 10 | Integration | No values | Empty result handling |
