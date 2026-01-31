# Performance Audit Phase 4 - Design Document

**Date:** 2026-01-31
**Status:** Implemented

## Executive Summary

Comprehensive performance audit covering database queries, page routes, bundle size, and infrastructure. Identified 44 issues across 4 categories. Applied immediate fixes to 10 high-impact issues.

## Assessment Results

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Database Queries | 12 | 6 | 2 | 20 |
| Page Routes | 2 | 6 | 6 | 14 |
| Bundle/Client | 2 | 1 | 1 | 4 |
| Infrastructure | 2 | 4 | 0 | 6 |
| **Total** | **18** | **17** | **9** | **44** |

---

## Fixes Applied (This Session)

### 1. N+1 Query Fix: `rentalYield.ts` → `getPortfolioSummary`
**Before:** 31 queries for 10 properties (1 + 3×N)
**After:** 4 queries total (properties + 3 batched queries)
**Impact:** ~87% query reduction

Changed from loop with individual queries to:
- Batch fetch all property values with `inArray`
- Batch fetch rent totals with `GROUP BY`
- Batch fetch expense totals with `GROUP BY`
- Index results by propertyId for O(1) lookup

### 2. O(n²) Filter Fix: `benchmarking.ts` → `getPortfolioSummary`
**Before:** O(n²) - 10k operations for 10 properties × 1k transactions
**After:** O(n) - Pre-indexed with Map

Added transaction indexing by propertyId before the loop:
```typescript
const txnsByProperty = new Map<string, typeof allTransactions>();
for (const txn of allTransactions) {
  if (txn.propertyId) {
    const existing = txnsByProperty.get(txn.propertyId) ?? [];
    existing.push(txn);
    txnsByProperty.set(txn.propertyId, existing);
  }
}
```

### 3. O(n²) Filter Fix: `cgt.ts` → `getSummary`
**Before:** O(n²) filter + fetching all transactions
**After:** O(n) with pre-indexed Map + DB-level category filter

- Added `sql\`category = ANY(${CAPITAL_CATEGORIES})\`` to WHERE clause
- Pre-indexed capital transactions by propertyId

### 4. Missing DB Filter: `cgt.ts` → `getSellingCosts`
**Before:** Fetched ALL transactions, filtered in memory
**After:** Filter to selling cost categories at DB level

### 5. Sequential Queries: `scenario.ts` → `run`
**Before:** 3 sequential await calls (properties, loans, recurring)
**After:** Single `Promise.all()` with parallel execution

### 6. Double Query: `propertyValue.ts` → `getCapitalGrowthStats`
**Before:** 2 separate queries for latest and previous valuation
**After:** Single query with `LIMIT 2`

### 7. Sequential Queries: `changelog/page.tsx`
**Before:** 4 sequential `await getEntries()` calls
**After:** Single `Promise.all()` with parallel execution

### 8. Loop Inserts: `banking.ts` → `syncAccount` anomaly alerts
**Before:** Up to 300 individual INSERT statements
**After:** Single batch INSERT with collected alerts

### 9. Bundle: Lazy-load jsPDF in `DownloadPDFButton.tsx`
**Before:** 500KB loaded on page mount
**After:** Dynamic import on button click with loading state

### 10. Bundle: Lazy-load PDF/Excel in `export/page.tsx`
**Before:** ~1.7MB (jsPDF + xlsx) loaded on page mount
**After:** Dynamic import on export action

---

## Remaining Issues (For Future Work)

### High Priority (Recommended Next)

1. **Database Connection Pooling** (`src/server/db/index.ts`)
   - Missing `max`, `idle_timeout`, `connect_timeout` config
   - Risk: Connection exhaustion under load

2. **Missing Cache-Control Headers** (25+ API routes)
   - Most routes lack explicit caching directives
   - Add `no-cache, no-store` to mutations
   - Add `max-age` to cacheable GETs

3. **PostHog Always Loaded** (~200KB)
   - Consider deferring initialization
   - Or use script tag instead of npm package

### Medium Priority

4. **N+1 in banking sync** - Individual transaction inserts (needed for duplicate handling, but could explore `ON CONFLICT`)

5. **Unbounded result sets** - Several cron jobs fetch without LIMIT

6. **Missing fetch timeouts** - External API calls without AbortSignal

7. **Client-side data fetching** - Several dashboard pages could benefit from server-side initial data

### Low Priority

8. **Barrel imports** - May prevent tree-shaking in some cases

9. **Report pages force-dynamic** - Could use ISR with short revalidate

---

## Performance Impact Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| rentalYield queries (10 props) | 31 | 4 | 87% ↓ |
| benchmarking operations | O(n²) | O(n) | Linear |
| cgt operations | O(n²) | O(n) | Linear |
| scenario queries | 3 sequential | 1 parallel | 66% latency ↓ |
| changelog queries | 4 sequential | 4 parallel | ~75% latency ↓ |
| banking anomaly inserts | N inserts | 1 batch | ~99% ↓ |
| Export page bundle | ~1.7MB | 0 (lazy) | 100% initial ↓ |
| Share PDF bundle | ~500KB | 0 (lazy) | 100% initial ↓ |

---

## Verification

- **Tests:** 747/747 passing
- **Lint:** 0 errors (131 warnings - unused imports in tests)
- **Type Check:** No errors

---

## Files Modified

1. `src/server/routers/rentalYield.ts`
2. `src/server/routers/benchmarking.ts`
3. `src/server/routers/cgt.ts`
4. `src/server/routers/scenario.ts`
5. `src/server/routers/propertyValue.ts`
6. `src/server/routers/banking.ts`
7. `src/app/changelog/page.tsx`
8. `src/components/share/DownloadPDFButton.tsx`
9. `src/app/(dashboard)/reports/export/page.tsx`
