# Wave 3.2 — Banking Services Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move 6 banking services into `services/banking/` subdirectory, fix anti-patterns, update all consumers.

**Architecture:** `git mv` files into new directory, create barrel `index.ts`, update 3 consumer import paths, fix anti-patterns in anomaly.ts (dynamic imports, `any` types, missing `::int` cast). Matches existing `services/scenario/` and `services/property-manager/` patterns.

**Tech Stack:** TypeScript 5 strict, Drizzle ORM, Vitest

**Design doc:** `docs/plans/2026-02-15-banking-services-restructure-design.md`

---

## Setup

### Task 0: Create worktree

**Step 1: Create worktree from develop**

```bash
git worktree add ~/worktrees/property-tracker/wave3.2-banking -b refactor/wave3.2-banking-services develop
cp ~/Documents/property-tracker/.env.local ~/worktrees/property-tracker/wave3.2-banking/.env.local
cd ~/worktrees/property-tracker/wave3.2-banking
npm install
```

**Step 2: Verify clean baseline**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 1: Move service files into `services/banking/`

**Files:**
- Move: `src/server/services/basiq.ts` → `src/server/services/banking/basiq.ts`
- Move: `src/server/services/sync.ts` → `src/server/services/banking/sync.ts`
- Move: `src/server/services/alerts.ts` → `src/server/services/banking/alerts.ts`
- Move: `src/server/services/anomaly.ts` → `src/server/services/banking/anomaly.ts`
- Move: `src/server/services/categorization.ts` → `src/server/services/banking/categorization.ts`
- Move: `src/server/services/csv-import.ts` → `src/server/services/banking/csv-import.ts`

**Step 1: Create directory and move files**

```bash
mkdir -p src/server/services/banking
git mv src/server/services/basiq.ts src/server/services/banking/basiq.ts
git mv src/server/services/sync.ts src/server/services/banking/sync.ts
git mv src/server/services/alerts.ts src/server/services/banking/alerts.ts
git mv src/server/services/anomaly.ts src/server/services/banking/anomaly.ts
git mv src/server/services/categorization.ts src/server/services/banking/categorization.ts
git mv src/server/services/csv-import.ts src/server/services/banking/csv-import.ts
```

**Step 2: Fix relative imports inside moved files**

After moving, internal imports that use `../` paths need updating (one level deeper now).

**anomaly.ts** — line 1:
```typescript
// Before:
import type { NewAnomalyAlert } from "../db/schema";
// After:
import type { NewAnomalyAlert } from "../../db/schema";
```

**categorization.ts** — lines 2-4:
```typescript
// Before:
import { db } from "../db";
import { merchantCategories, categorizationExamples, transactions } from "../db/schema";
// After:
import { db } from "../../db";
import { merchantCategories, categorizationExamples, transactions } from "../../db/schema";
```

**basiq.ts** — line 4:
```typescript
// Before:
import { ExternalServiceError } from "@/server/errors";
// After: (no change — uses @ alias, not relative)
```

**csv-import.ts** — line 2:
```typescript
// Before:
import { ValidationError } from "@/server/errors";
// After: (no change — uses @ alias, not relative)
```

**sync.ts** and **alerts.ts** — no imports from parent dirs, no changes needed.

**Step 3: Verify type check**

```bash
npx tsc --noEmit
```

Expected: errors about consumers importing from old paths. That's expected — we fix consumers next.

---

## Task 2: Move test files into `services/banking/__tests__/`

**Files:**
- Move: `src/server/services/__tests__/basiq.test.ts` → `src/server/services/banking/__tests__/basiq.test.ts`
- Move: `src/server/services/__tests__/sync.test.ts` → `src/server/services/banking/__tests__/sync.test.ts`
- Move: `src/server/services/__tests__/alerts.test.ts` → `src/server/services/banking/__tests__/alerts.test.ts`
- Move: `src/server/services/__tests__/anomaly.test.ts` → `src/server/services/banking/__tests__/anomaly.test.ts`
- Move: `src/server/services/__tests__/csv-import.test.ts` → `src/server/services/banking/__tests__/csv-import.test.ts`

**Step 1: Create directory and move files**

```bash
mkdir -p src/server/services/banking/__tests__
git mv src/server/services/__tests__/basiq.test.ts src/server/services/banking/__tests__/basiq.test.ts
git mv src/server/services/__tests__/sync.test.ts src/server/services/banking/__tests__/sync.test.ts
git mv src/server/services/__tests__/alerts.test.ts src/server/services/banking/__tests__/alerts.test.ts
git mv src/server/services/__tests__/anomaly.test.ts src/server/services/banking/__tests__/anomaly.test.ts
git mv src/server/services/__tests__/csv-import.test.ts src/server/services/banking/__tests__/csv-import.test.ts
```

**Step 2: Test files use `../anomaly`, `../sync`, etc. — these still work** since tests are now at `banking/__tests__/` and sources at `banking/`. No import changes needed in test files.

---

## Task 3: Create barrel `index.ts`

**Files:**
- Create: `src/server/services/banking/index.ts`

**Step 1: Create the barrel file**

Model after `services/scenario/index.ts` — explicit named re-exports (not `export *`):

```typescript
// Basiq API client
export { basiqService } from "./basiq";
export type {
  BasiqUser,
  BasiqConnection,
  BasiqAccount,
  BasiqTransaction,
} from "./basiq";

// Bank sync utilities
export {
  checkRateLimit,
  calculateRetryAfter,
  mapBasiqErrorToAlertType,
  mapAlertTypeToConnectionStatus,
  RATE_LIMIT_MINUTES,
} from "./sync";
export type { RateLimitResult, AlertType } from "./sync";

// Connection alert utilities
export {
  shouldCreateAlert,
  shouldSendEmail,
  formatAlertForEmail,
} from "./alerts";

// Anomaly detection
export {
  detectUnusualAmount,
  detectDuplicates,
  detectUnexpectedExpense,
  detectMissedRent,
  calculateSimilarity,
  getHistoricalAverage,
  getKnownMerchants,
} from "./anomaly";

// AI categorization
export {
  batchCategorize,
  categorizeTransaction,
  categorizeWithClaude,
  getMerchantCategory,
  getRecentExamples,
  updateMerchantMemory,
  normalizeMerchantName,
  buildCategorizationPrompt,
  parseCategorizationResponse,
} from "./categorization";
export type { CategorizationResult, Example } from "./categorization";

// CSV import
export {
  parseCSV,
  parseRichCSV,
  parseCSVHeaders,
  splitCSVLine,
  sanitizeField,
  matchCategory,
  matchTransactionType,
  parseBooleanField,
  csvRowSchema,
} from "./csv-import";
export type { CSVRow, CSVColumnMap, ParsedCSVRow } from "./csv-import";
```

**Step 2: Verify the barrel compiles**

```bash
npx tsc --noEmit
```

Expected: still errors from consumers (old import paths). Fixed in next task.

---

## Task 4: Update consumer imports

**Files:**
- Modify: `src/server/routers/banking.ts` (lines 4-15)
- Modify: `src/server/routers/transaction.ts` (line 7)
- Modify: `src/app/api/cron/anomaly-detection/route.ts` (line 10)

**Step 1: Update `src/server/routers/banking.ts`**

Replace 4 separate imports (lines 4-15):

```typescript
// Before:
import { batchCategorize } from "../services/categorization";
import { checkRateLimit, mapBasiqErrorToAlertType, mapAlertTypeToConnectionStatus } from "../services/sync";
import { shouldCreateAlert } from "../services/alerts";
import { basiqService } from "../services/basiq";
import {
  detectUnusualAmount,
  detectDuplicates,
  detectUnexpectedExpense,
  getHistoricalAverage,
  getKnownMerchants,
} from "../services/anomaly";

// After:
import {
  batchCategorize,
  checkRateLimit,
  mapBasiqErrorToAlertType,
  mapAlertTypeToConnectionStatus,
  shouldCreateAlert,
  basiqService,
  detectUnusualAmount,
  detectDuplicates,
  detectUnexpectedExpense,
  getHistoricalAverage,
  getKnownMerchants,
} from "../services/banking";
```

**Step 2: Update `src/server/routers/transaction.ts`**

Replace line 7:

```typescript
// Before:
import { parseCSV } from "../services/csv-import";
// After:
import { parseCSV } from "../services/banking";
```

**Step 3: Update `src/app/api/cron/anomaly-detection/route.ts`**

Replace line 10:

```typescript
// Before:
import { detectMissedRent } from "@/server/services/anomaly";
// After:
import { detectMissedRent } from "@/server/services/banking";
```

**Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 5: Run unit tests**

```bash
npx vitest run src/server/services/banking/
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move banking services into services/banking/

Move basiq, sync, alerts, anomaly, categorization, csv-import
into services/banking/ with barrel index.ts. Update 3 consumers.
Tests co-located in services/banking/__tests__/."
```

---

## Task 5: Fix anti-patterns in `anomaly.ts`

**Files:**
- Modify: `src/server/services/banking/anomaly.ts` (lines 204-260)

**Step 1: Add top-level imports, replace dynamic imports and `any` type**

At the top of the file, add after existing import (line 1):

```typescript
// Before (line 1 only):
import type { NewAnomalyAlert } from "../../db/schema";

// After (lines 1-4):
import type { NewAnomalyAlert } from "../../db/schema";
import { transactions } from "../../db/schema";
import { eq, and, gte, like, sql } from "drizzle-orm";
import type { DB } from "../../repositories/base";
```

**Step 2: Fix `getHistoricalAverage` (lines 204-234)**

```typescript
// Before:
export async function getHistoricalAverage(
  db: any,
  userId: string,
  merchantPattern: string,
  months: number = 6
): Promise<HistoricalAverage> {
  const { transactions } = await import("../../db/schema");
  const { eq, and, gte, like, sql } = await import("drizzle-orm");

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await db
    .select({
      avg: sql<number>`AVG(ABS(CAST(${transactions.amount} AS DECIMAL)))`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        like(transactions.description, `%${merchantPattern}%`),
        gte(transactions.date, startDate.toISOString().split("T")[0])
      )
    );

  return {
    avg: result[0]?.avg ?? 0,
    count: result[0]?.count ?? 0,
  };
}

// After:
export async function getHistoricalAverage(
  db: DB,
  userId: string,
  merchantPattern: string,
  months: number = 6
): Promise<HistoricalAverage> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await db
    .select({
      avg: sql<number>`AVG(ABS(CAST(${transactions.amount} AS DECIMAL)))`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        like(transactions.description, `%${merchantPattern}%`),
        gte(transactions.date, startDate.toISOString().split("T")[0])
      )
    );

  return {
    avg: result[0]?.avg ?? 0,
    count: result[0]?.count ?? 0,
  };
}
```

Changes: `db: any` → `db: DB`, removed dynamic imports, added `::int` to `COUNT(*)`.

**Step 3: Fix `getKnownMerchants` (lines 236-260)**

```typescript
// Before:
export async function getKnownMerchants(
  db: any,
  userId: string,
  propertyId?: string
): Promise<Set<string>> {
  const { transactions } = await import("../../db/schema");
  const { eq, and } = await import("drizzle-orm");

  // ... rest unchanged
}

// After:
export async function getKnownMerchants(
  db: DB,
  userId: string,
  propertyId?: string
): Promise<Set<string>> {
  const conditions = [eq(transactions.userId, userId)];
  if (propertyId) {
    conditions.push(eq(transactions.propertyId, propertyId));
  }

  const result = await db
    .selectDistinct({ description: transactions.description })
    .from(transactions)
    .where(and(...conditions));

  const merchants = new Set<string>();
  for (const row of result) {
    merchants.add(extractMerchant(row.description));
  }

  return merchants;
}
```

Changes: `db: any` → `db: DB`, removed dynamic imports.

**Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If callers of `getHistoricalAverage`/`getKnownMerchants` pass `ctx.db`, it should satisfy `DB` type. Check `banking.ts` router if errors occur.

**Step 5: Run tests**

```bash
npx vitest run src/server/services/banking/
```

Expected: all pass. The anomaly tests only test pure functions (detectUnusualAmount, etc.), not getHistoricalAverage/getKnownMerchants which need a DB.

**Step 6: Commit**

```bash
git add -A
git commit -m "fix: anti-patterns in anomaly.ts — dynamic imports, any types, missing ::int

- Replace dynamic imports with top-level imports
- Replace db: any with db: DB (from repositories/base)
- Add ::int cast to COUNT(*) aggregate"
```

---

## Task 6: Verify `batchCategorize` sequential loop

**Files:**
- Read: `src/server/services/banking/categorization.ts` (lines 294-311)

**Step 1: Assess whether to parallelize**

The `batchCategorize` function loops sequentially over transactions, calling `categorizeTransaction` for each. Each call:
1. Queries merchant memory (DB read)
2. Potentially calls Anthropic Claude API (external HTTP)
3. Updates the transaction record (DB write)

**Decision: Keep sequential.** The anti-pattern "sequential awaits for independent queries" refers to independent DB queries. This loop involves external API calls with rate limits. Parallelizing would risk Anthropic API rate limiting. Add a clarifying comment instead.

**Step 2: Add comment**

At the `for` loop in `batchCategorize`:

```typescript
// Before:
  for (const txn of transactionData) {
// After:
  // Sequential intentionally — each call may hit Anthropic API with rate limits
  for (const txn of transactionData) {
```

**Step 3: Commit** (combine with Task 7 if the change is trivial)

---

## Task 7: Update `src/server/CLAUDE.md` references

**Files:**
- Modify: `src/server/CLAUDE.md`

**Step 1: Update the categorization service path reference**

In the Key Files table, update:

```markdown
// Before:
| `src/server/services/categorization.ts` | AI categorization service (Anthropic SDK) |
// After:
| `src/server/services/banking/categorization.ts` | AI categorization service (Anthropic SDK) |
```

**Step 2: Commit**

```bash
git add -A
git commit -m "docs: update CLAUDE.md service paths after banking restructure"
```

---

## Task 8: Final validation and PR

**Step 1: Type check**

```bash
npx tsc --noEmit
```

**Step 2: Lint**

```bash
npx next lint
```

**Step 3: Unit tests**

```bash
npx vitest run src/server/services/banking/
```

**Step 4: Full test suite**

```bash
npm run test:unit
```

**Step 5: Build**

```bash
npm run build
```

**Step 6: Create PR**

```bash
gh pr create --base develop --title "refactor: Wave 3.2 — restructure banking services into services/banking/" --body "$(cat <<'EOF'
## Summary
- Move 6 banking services (basiq, sync, alerts, anomaly, categorization, csv-import) into `services/banking/`
- Move 5 co-located test files into `services/banking/__tests__/`
- Create barrel `services/banking/index.ts` with explicit named exports
- Update 3 consumers (banking router, transaction router, anomaly cron)
- Fix anti-patterns in anomaly.ts: dynamic imports → top-level, `db: any` → `db: DB`, `COUNT(*)` → `COUNT(*)::int`

## Test plan
- [ ] `tsc --noEmit` passes
- [ ] `next lint` passes
- [ ] `npm run build` passes
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Banking service tests pass (`vitest run src/server/services/banking/`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Tech Notes

**`DB` type from `repositories/base.ts`:** `PostgresJsDatabase<typeof schema>` — this is the same type as `ctx.db` in routers, so callers don't need changes.

**`batchCategorize` kept sequential:** The loop calls Anthropic's Claude API per transaction. Parallelizing risks 429 rate limits. This is NOT the same as independent DB queries — the anti-pattern rule doesn't apply here.

**Barrel pattern:** Uses explicit named re-exports (not `export *`) matching `services/scenario/index.ts`. This ensures tree-shaking works and makes the public API explicit.

**Test import paths unchanged:** Tests at `banking/__tests__/x.test.ts` importing from `../x` still resolve correctly after the move since both source and test moved together.
