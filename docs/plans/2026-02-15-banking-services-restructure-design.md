# Wave 3.2 — Banking Services Restructure Design

**Goal:** Move 6 banking-related services from flat `services/` into `services/banking/` subdirectory. Fix anti-patterns found during the move.

**Trigger:** Services directory has 50+ flat files. Banking services (basiq, sync, alerts, anomaly, categorization, csv-import) form a cohesive domain that should be co-located — matching the existing `services/property-manager/` and `services/scenario/` patterns.

## Scope

### Files Moving

| Source | Destination |
|--------|-------------|
| `services/basiq.ts` | `services/banking/basiq.ts` |
| `services/sync.ts` | `services/banking/sync.ts` |
| `services/alerts.ts` | `services/banking/alerts.ts` |
| `services/anomaly.ts` | `services/banking/anomaly.ts` |
| `services/categorization.ts` | `services/banking/categorization.ts` |
| `services/csv-import.ts` | `services/banking/csv-import.ts` |
| `services/__tests__/basiq.test.ts` | `services/banking/__tests__/basiq.test.ts` |
| `services/__tests__/sync.test.ts` | `services/banking/__tests__/sync.test.ts` |
| `services/__tests__/anomaly.test.ts` | `services/banking/__tests__/anomaly.test.ts` |
| `services/__tests__/csv-import.test.ts` | `services/banking/__tests__/csv-import.test.ts` (if exists) |

**New file:** `services/banking/index.ts` — barrel re-export.

### Consumer Updates (3 files)

| Consumer | Current Import | New Import |
|----------|---------------|------------|
| `routers/banking.ts` | 4 separate `../services/*` | `../services/banking` |
| `routers/transaction.ts` | `../services/csv-import` | `../services/banking` |
| `api/cron/anomaly-detection/route.ts` | `@/server/services/anomaly` | `@/server/services/banking` |

### Anti-Pattern Fixes (During Move)

**anomaly.ts — 4 issues:**
1. Dynamic `await import("../db/schema")` → top-level import
2. Dynamic `await import("drizzle-orm")` → top-level import
3. `db: any` parameter type → proper `DB` type
4. `COUNT(*)` without `::int` cast → `COUNT(*)::int`

**categorization.ts — 1 issue:**
1. Sequential `for` loop with `await` in `batchCategorize` → `Promise.all()` with concurrency awareness (rate limit for Anthropic API)

### Not in Scope
- No logic changes to any service
- No new features
- No changes to service public APIs (exports stay identical)
- Anti-pattern fixes in files NOT being moved

## Approach

Single PR: move files via `git mv`, create barrel, update imports, fix anti-patterns, validate.
