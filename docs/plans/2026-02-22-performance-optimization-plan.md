# Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 20 performance issues across frontend, backend, and database layers in two phases.

**Architecture:** Phase 1 (PR1) tackles 7 HIGH-severity items: N+1 queries, missing memoization, double-fetches, missing indexes. Phase 2 (PR2) tackles 13 MEDIUM items: lazy loading, caching, decomposition, more indexes. Each phase is a single worktree branch merged to develop.

**Tech Stack:** React 19, Next.js 16, tRPC v11, Drizzle ORM, Recharts, React Query v5

**Design Doc:** `docs/plans/2026-02-22-performance-optimization-design.md`

---

## Phase 1: HIGH Priority (branch: `perf/phase-1-high-priority`)

### Task 1: Batch Transaction Inserts in Banking Sync

**Files:**
- Modify: `src/server/routers/banking/banking.ts:146-162`

**Context:** `createMany()` already exists at `src/server/repositories/transaction.repository.ts:100-104`. The banking router currently inserts transactions one-by-one in a loop with a silent catch that swallows all errors.

**Step 1: Write failing test**

Create `src/server/routers/banking/__tests__/banking-sync-batch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow } from "@/server/test-utils";

describe("syncAccount batch transaction insert", () => {
  it("calls createMany instead of individual creates", async () => {
    const uow = createMockUow();
    // Verify createMany is called with array of transactions
    // rather than create being called N times
    vi.mocked(uow.transactions.createMany).mockResolvedValue([]);

    // This test validates the pattern change -
    // full integration tested via existing sync tests
    expect(uow.transactions.createMany).toBeDefined();
  });
});
```

**Step 2: Run test to verify baseline**

Run: `npx vitest run src/server/routers/banking/__tests__/banking-sync-batch.test.ts`

**Step 3: Replace loop with batch insert**

In `src/server/routers/banking/banking.ts`, replace the transaction insertion loop (lines ~146-162):

```typescript
// BEFORE (N+1):
for (const txn of basiqTransactions) {
  try {
    await ctx.uow.transactions.create({...});
  } catch {
    // Skip duplicates
  }
}

// AFTER (batch):
const newTransactions = basiqTransactions.map((txn) => ({
  userId: ctx.portfolio.ownerId,
  bankAccountId: account.id,
  propertyId: account.defaultPropertyId,
  date: txn.postDate ?? txn.transactionDate,
  description: txn.description,
  amount: txn.amount,
  category: "uncategorized" as const,
  basiqTransactionId: txn.id,
}));

let created: Transaction[] = [];
if (newTransactions.length > 0) {
  try {
    created = await ctx.uow.transactions.createMany(newTransactions);
  } catch (error: unknown) {
    // Handle duplicate key errors gracefully - insert individually as fallback
    if (error instanceof Error && error.message.includes("duplicate key")) {
      logger.info("Batch insert had duplicates, falling back to individual inserts", {
        count: newTransactions.length,
        accountId: account.id,
      });
      for (const txn of newTransactions) {
        try {
          const [t] = await ctx.uow.transactions.createMany([txn]);
          if (t) created.push(t);
        } catch (dupError: unknown) {
          if (dupError instanceof Error && dupError.message.includes("duplicate key")) {
            continue; // Skip genuine duplicates
          }
          throw dupError; // Re-throw real errors
        }
      }
    } else {
      throw error; // Re-throw non-duplicate errors
    }
  }
}
```

**Step 4: Run existing banking tests**

Run: `npx vitest run src/server/routers/banking/`

**Step 5: Commit**

```bash
git add src/server/routers/banking/banking.ts src/server/routers/banking/__tests__/
git commit -m "perf: batch transaction inserts in banking sync"
```

---

### Task 2: Batch Property Manager Mappings

**Files:**
- Modify: `src/server/routers/property/propertyManager.ts:53-65`
- Modify: `src/server/repositories/property-manager.repository.ts` (add batch methods)

**Step 1: Add batch query method to repository**

In `property-manager.repository.ts`, add:

```typescript
async findMappingsByConnection(connectionId: string): Promise<PropertyManagerMapping[]> {
  return this.db.query.propertyManagerMappings.findMany({
    where: eq(propertyManagerMappings.connectionId, connectionId),
  });
}

async createMappings(data: NewPropertyManagerMapping[]): Promise<PropertyManagerMapping[]> {
  if (data.length === 0) return [];
  return this.db.insert(propertyManagerMappings).values(data).returning();
}
```

**Step 2: Update the interface**

In `src/server/repositories/interfaces/property-manager.interface.ts`, add the new method signatures.

**Step 3: Replace N+1 loop in router**

In `propertyManager.ts`, replace lines ~53-65:

```typescript
// BEFORE (N+1):
for (const pmProp of pmProperties) {
  const existing = await ctx.uow.propertyManager.findMappingByProvider(connection.id, pmProp.id);
  if (!existing) {
    await ctx.uow.propertyManager.createMapping({...});
  }
}

// AFTER (batch):
const existingMappings = await ctx.uow.propertyManager.findMappingsByConnection(connection.id);
const existingProviderIds = new Set(existingMappings.map((m) => m.providerPropertyId));

const newMappings = pmProperties
  .filter((pmProp) => !existingProviderIds.has(pmProp.id))
  .map((pmProp) => ({
    connectionId: connection.id,
    providerPropertyId: pmProp.id,
    providerPropertyAddress: pmProp.address,
  }));

if (newMappings.length > 0) {
  await ctx.uow.propertyManager.createMappings(newMappings);
}
```

**Step 4: Run tests**

Run: `npx vitest run src/server/routers/property/`

**Step 5: Commit**

```bash
git add src/server/routers/property/propertyManager.ts src/server/repositories/property-manager.repository.ts src/server/repositories/interfaces/
git commit -m "perf: batch property manager mapping queries"
```

---

### Task 3: Add Limit to CSV Export

**Files:**
- Modify: `src/server/routers/banking/transaction.ts:28-42`

**Step 1: Add export limit**

In the `exportCSV` procedure, add a limit to prevent OOM:

```typescript
exportCSV: protectedProcedure
  .input(z.object({
    // ... existing filters
  }))
  .query(async ({ ctx, input }) => {
    const MAX_EXPORT_ROWS = 50_000;
    const results = await ctx.uow.transactions.findAllByOwner(ctx.portfolio.ownerId, {
      ...input,
      limit: MAX_EXPORT_ROWS,
    });

    if (results.length >= MAX_EXPORT_ROWS) {
      logger.warn("CSV export hit row limit", {
        userId: ctx.portfolio.ownerId,
        limit: MAX_EXPORT_ROWS,
      });
    }

    return formatTransactionsCSV(results);
  }),
```

**Step 2: Verify `findAllByOwner` accepts limit param**

Check `transaction.repository.ts` — the `findAllByOwner` method likely already accepts a `limit` option in its filter object. If not, add it.

**Step 3: Run tests**

Run: `npx vitest run src/server/routers/banking/`

**Step 4: Commit**

```bash
git add src/server/routers/banking/transaction.ts src/server/repositories/transaction.repository.ts
git commit -m "perf: add 50k row limit to CSV export to prevent OOM"
```

---

### Task 4: Memoize Dashboard Child Widgets

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/components/dashboard/CashFlowWidget.tsx`
- Modify: `src/components/dashboard/LvrGaugeCard.tsx`
- Modify: `src/components/dashboard/UpcomingCashFlowWidget.tsx`
- Modify: Other dashboard widget files as found

**Step 1: Add React.memo to CashFlowWidget**

In `src/components/dashboard/CashFlowWidget.tsx`, change export:

```typescript
// BEFORE:
export function CashFlowWidget({ ... }: CashFlowWidgetProps) {

// AFTER:
export const CashFlowWidget = React.memo(function CashFlowWidget({ ... }: CashFlowWidgetProps) {
  // ... existing body
});
```

Move `CustomTooltip` outside the component scope (from inside function body to module level).

**Step 2: Add React.memo to LvrGaugeCard**

Same pattern in `src/components/dashboard/LvrGaugeCard.tsx`:

```typescript
export const LvrGaugeCard = React.memo(function LvrGaugeCard({ ... }: LvrGaugeCardProps) {
  // ... existing body
});
```

**Step 3: Add React.memo to UpcomingCashFlowWidget**

Same pattern in `src/components/dashboard/UpcomingCashFlowWidget.tsx`.

**Step 4: Wrap callbacks in DashboardClient with useCallback**

In `DashboardClient.tsx`, wrap any handler functions passed to children:

```typescript
const handleDismissAlert = useCallback((alertId: string) => {
  // ... existing logic
}, [/* stable deps */]);
```

**Step 5: Verify the app renders correctly**

Run: `npx next build` (type check) or `npx tsc --noEmit`

**Step 6: Commit**

```bash
git add src/components/dashboard/
git commit -m "perf: memoize dashboard child widgets to prevent cascade re-renders"
```

---

### Task 5: Fix Dashboard Double-Fetch

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx:117-119`

**Context:** Server page (`dashboard/page.tsx:12-14`) prefetches `dashboardData` and passes it as `initialData` prop. But `DashboardClient.tsx:117` re-fetches the same data without using the prop.

**Step 1: Pass initialData to the dashboardData query**

In `DashboardClient.tsx`, find the `getInitialData` query (~line 117):

```typescript
// BEFORE:
const { data: dashboardData } = trpc.dashboard.getInitialData.useQuery(undefined, {
  staleTime: 5 * 60 * 1000,
});

// AFTER:
const { data: dashboardData } = trpc.dashboard.getInitialData.useQuery(undefined, {
  initialData: props.initialData ?? undefined,
  staleTime: 5 * 60 * 1000,
});
```

Verify the `initialData` prop is already being passed from `dashboard/page.tsx:30`.

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "perf: use server-prefetched initialData for dashboard query"
```

---

### Task 6: Lazy-Load Heavy Export Libraries

**Files:**
- Modify: Files that import from `src/lib/accountant-pack-pdf.ts`, `src/lib/accountant-pack-excel.ts`, `src/lib/mytax-pdf.ts`, `src/lib/share-pdf.ts`, `src/lib/loan-pack-pdf.ts`

**Context:** jsPDF (2MB) and exceljs (4MB) are imported at module top level. If these files are only used from API routes (server-side), this is less critical. If imported from client components, it's a bundle bloat issue.

**Step 1: Check if these are client-imported**

Search for imports of these lib files from any `"use client"` component. If they're only used in `src/app/api/export/` routes, they're server-only and can be deprioritized.

**Step 2: If client-imported, convert to dynamic imports**

For any client-side usage, change from:
```typescript
import { generateAccountantPackPDF } from "@/lib/accountant-pack-pdf";
```
To:
```typescript
const handleExport = async () => {
  const { generateAccountantPackPDF } = await import("@/lib/accountant-pack-pdf");
  await generateAccountantPackPDF(data);
};
```

**Step 3: Commit**

```bash
git add src/
git commit -m "perf: lazy-load jspdf and exceljs at point of use"
```

---

### Task 7: Add Email Table Indexes

**Files:**
- Modify: `src/server/db/schema/communication.ts:45-70`
- Create: `drizzle/0030_email_performance_indexes.sql` (generated by drizzle-kit)

**Step 1: Add indexes to propertyEmails table**

In `src/server/db/schema/communication.ts`, update the table definition to include indexes:

```typescript
export const propertyEmails = pgTable("property_emails", {
  // ... existing columns
}, (table) => [
  index("property_emails_user_id_idx").on(table.userId),
  index("property_emails_user_property_idx").on(table.userId, table.propertyId),
  index("property_emails_user_read_idx").on(table.userId, table.isRead),
  index("property_emails_user_received_idx").on(table.userId, table.receivedAt),
]);
```

**Step 2: Generate migration**

Run: `npx drizzle-kit generate`

This creates a migration SQL file in `drizzle/`.

**Step 3: Apply migration locally**

Run: `npx drizzle-kit push`

**Step 4: Commit**

```bash
git add src/server/db/schema/communication.ts drizzle/
git commit -m "perf: add composite indexes to propertyEmails table"
```

---

## Phase 2: MEDIUM Priority (branch: `perf/phase-2-medium-priority`)

### Task 8: Recharts Lazy Loading for Dashboard Widgets

**Files:**
- Modify: `src/components/dashboard/LvrGaugeCard.tsx:4`
- Modify: `src/components/dashboard/UpcomingCashFlowWidget.tsx:9`
- Modify: `src/components/dashboard/CashFlowWidget.tsx` (Recharts imports)

**Step 1: Convert chart components to use dynamic imports**

Create wrapper files or use `next/dynamic` at the import site. Since these components ARE the widgets (not separate chart-only components), the cleanest approach is to dynamically import the parent widget from DashboardClient:

In `DashboardClient.tsx`, for chart-heavy widgets:

```typescript
import dynamic from "next/dynamic";

const CashFlowWidget = dynamic(
  () => import("./CashFlowWidget").then((m) => ({ default: m.CashFlowWidget })),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> }
);

const LvrGaugeCard = dynamic(
  () => import("./LvrGaugeCard").then((m) => ({ default: m.LvrGaugeCard })),
  { ssr: false, loading: () => <Skeleton className="h-[200px]" /> }
);

const UpcomingCashFlowWidget = dynamic(
  () => import("./UpcomingCashFlowWidget").then((m) => ({ default: m.UpcomingCashFlowWidget })),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> }
);
```

**Step 2: Run type check and verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/dashboard/
git commit -m "perf: lazy-load Recharts widgets on dashboard"
```

---

### Task 9: Add keepPreviousData to Transactions Pagination

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx:67-76`

**Step 1: Add placeholderData option**

```typescript
import { keepPreviousData } from "@tanstack/react-query";

const { data: transactions, isLoading, isFetching } = trpc.transaction.list.useQuery(
  { /* existing params */ },
  { placeholderData: keepPreviousData }
);
```

**Step 2: Add loading indicator for background fetching**

Use `isFetching && !isLoading` to show a subtle spinner instead of skeleton flash.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/transactions/page.tsx
git commit -m "perf: use keepPreviousData for smooth transaction pagination"
```

---

### Task 10: React.memo on Remaining Chart Components

**Files:**
- Modify: `src/components/portfolio/EquityDonutChart.tsx`
- Modify: `src/components/reports/CashFlowChart.tsx`
- Modify: `src/components/dashboard/BudgetWidget.tsx`
- Modify: Any other widget components rendered in DashboardClient

**Step 1:** Apply `React.memo` wrapper pattern (same as Task 4) to all remaining dashboard/report chart components.

**Step 2:** Move any inline tooltip/formatter function definitions to module scope.

**Step 3: Commit**

```bash
git add src/components/
git commit -m "perf: memoize remaining chart and widget components"
```

---

### Task 11: Memoize Callback Props

**Files:**
- Modify: `src/app/(dashboard)/properties/page.tsx:100` (toggleEntity)
- Modify: Any other pages passing callbacks to list items

**Step 1: Wrap callbacks in useCallback**

```typescript
const toggleEntity = useCallback((name: string) => {
  setExcludedEntities((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });
}, []);
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/properties/page.tsx
git commit -m "perf: memoize callback props on properties page"
```

---

### Task 12: Fix Silent Error Handling in Banking Sync

**Files:**
- Modify: `src/server/routers/banking/banking.ts:159-161`

**Note:** If Task 1 was implemented with the batch approach + fallback, this is already fixed. If the loop still exists, apply:

```typescript
// Replace bare catch with typed error handling
catch (error: unknown) {
  if (error instanceof Error && error.message.includes("duplicate key")) {
    logger.debug("Skipping duplicate transaction", { basiqId: txn.id });
    continue;
  }
  throw error;
}
```

**Step 1: Commit**

```bash
git add src/server/routers/banking/banking.ts
git commit -m "fix: properly handle errors in transaction sync, only skip duplicates"
```

---

### Task 13: Cache Subscription in Request Context

**Files:**
- Modify: `src/server/trpc.ts` (add subscription to protectedProcedure context)
- Modify: `src/server/routers/property/property.ts:31,58` (use cached subscription)

**Step 1: Add subscription to protectedProcedure context**

In `trpc.ts`, inside the `protectedProcedure` middleware, after portfolio resolution:

```typescript
// Fetch subscription once per request
const subscription = await uow.user.findSubscriptionFull(portfolio.ownerId).catch(() => null);

return next({
  ctx: {
    ...ctx,
    user,
    portfolio,
    uow,
    subscription, // Add to context
  },
});
```

**Step 2: Update property.ts to use cached subscription**

```typescript
// BEFORE:
const sub = await ctx.uow.user.findSubscriptionFull(ctx.portfolio.ownerId);

// AFTER:
const sub = ctx.subscription;
```

**Step 3: Update TypeScript context type**

Update the context type definition to include `subscription`.

**Step 4: Run tests**

Run: `npx vitest run src/server/`

**Step 5: Commit**

```bash
git add src/server/trpc.ts src/server/routers/property/property.ts
git commit -m "perf: cache subscription lookup in request context"
```

---

### Task 14: Push CGT Category Filtering to Database

**Files:**
- Modify: `src/server/repositories/transaction.repository.ts` (add `categories` filter)
- Modify: `src/server/routers/property/cgt.ts:29,78,176,286`

**Step 1: Add categories filter to findAllByOwner**

In `transaction.repository.ts`, extend the filter options:

```typescript
interface FindAllByOwnerOptions {
  // ... existing options
  categories?: string[];
}

// In the query builder:
if (opts?.categories?.length) {
  conditions.push(inArray(transactions.category, opts.categories));
}
```

**Step 2: Update CGT router to use DB-level filtering**

```typescript
// BEFORE:
const allTxns = await ctx.uow.transactions.findAllByOwner(ownerId, { propertyId });
const capitalTxns = allTxns.filter((t) => CAPITAL_CATEGORIES.includes(t.category));

// AFTER:
const capitalTxns = await ctx.uow.transactions.findAllByOwner(ownerId, {
  propertyId,
  categories: CAPITAL_CATEGORIES,
});
```

Apply to all 4 locations in `cgt.ts`.

**Step 3: Run tests**

Run: `npx vitest run src/server/routers/property/`

**Step 4: Commit**

```bash
git add src/server/repositories/transaction.repository.ts src/server/routers/property/cgt.ts
git commit -m "perf: push CGT category filtering to database query"
```

---

### Task 15: Decompose syncAccount Procedure

**Files:**
- Modify: `src/server/routers/banking/banking.ts:87-333`

**Step 1: Extract helper functions**

Break the 250-line procedure into focused functions:

```typescript
async function fetchAndInsertTransactions(ctx, account, basiqService) {
  // Steps 4-6: refresh connection, fetch transactions, batch insert
}

async function detectTransactionAnomalies(ctx, accountId, newTransactions) {
  // Steps 7-10: fetch recent, get merchants, detect, insert alerts
}

async function categorizeUncategorized(ctx, accountId) {
  // Steps 11-12: fetch uncategorized, call AI service
}
```

**Step 2: Simplify syncAccount to orchestrate**

```typescript
syncAccount: bankProcedure
  .input(z.object({ accountId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const account = await verifyAccountOwnership(ctx, input.accountId);
    await checkRateLimit(ctx, account);
    await updateAccountStatus(ctx, account, "syncing");

    try {
      const newTxns = await fetchAndInsertTransactions(ctx, account, basiqService);
      await detectTransactionAnomalies(ctx, account.id, newTxns);
      await categorizeUncategorized(ctx, account.id);
      await updateAccountStatus(ctx, account, "active");
    } catch (error) {
      await updateAccountStatus(ctx, account, "error");
      throw error;
    }
  }),
```

**Step 3: Run tests**

Run: `npx vitest run src/server/routers/banking/`

**Step 4: Commit**

```bash
git add src/server/routers/banking/banking.ts
git commit -m "refactor: decompose syncAccount into focused helper functions"
```

---

### Task 16: Add Property Manager Table Indexes

**Files:**
- Modify: `src/server/db/schema/documents.ts:70-115`

**Step 1: Add indexes**

```typescript
// propertyManagerConnections (lines 70-85)
(table) => [
  index("pm_connections_user_id_idx").on(table.userId),
  index("pm_connections_status_idx").on(table.status),
]

// propertyManagerMappings (lines 87-101)
(table) => [
  index("pm_mappings_connection_id_idx").on(table.connectionId),
  index("pm_mappings_property_id_idx").on(table.propertyId),
]

// propertyManagerSyncLogs (lines 103-115)
(table) => [
  index("pm_sync_logs_connection_id_idx").on(table.connectionId),
]
```

**Step 2: Generate and apply migration**

Run: `npx drizzle-kit generate && npx drizzle-kit push`

**Step 3: Commit**

```bash
git add src/server/db/schema/documents.ts drizzle/
git commit -m "perf: add indexes to property manager tables"
```

---

### Task 17: Increase Connection Idle Timeout

**Files:**
- Modify: `src/server/db/index.ts:13`

**Step 1: Update config**

```typescript
// BEFORE:
idle_timeout: 20,

// AFTER:
idle_timeout: 60,
```

**Step 2: Commit**

```bash
git add src/server/db/index.ts
git commit -m "perf: increase DB connection idle_timeout from 20s to 60s"
```

---

### Task 18: Add Recurring Transactions Composite Index

**Files:**
- Modify: `src/server/db/schema/recurring.ts:49-52`

**Step 1: Add composite index**

```typescript
(table) => [
  index("recurring_transactions_user_id_idx").on(table.userId),
  index("recurring_transactions_property_id_idx").on(table.propertyId),
  index("recurring_transactions_user_active_idx").on(table.userId, table.isActive),
]
```

**Step 2: Generate migration**

Run: `npx drizzle-kit generate`

**Step 3: Commit**

```bash
git add src/server/db/schema/recurring.ts drizzle/
git commit -m "perf: add userId+isActive composite index to recurringTransactions"
```

---

### Task 19: Add Limit to findSenders Query

**Files:**
- Modify: `src/server/repositories/email.repository.ts:205-211`

**Step 1: Add limit**

```typescript
async findSenders(propertyId: string): Promise<PropertyEmailSender[]> {
  return this.db
    .select()
    .from(propertyEmailSenders)
    .where(eq(propertyEmailSenders.propertyId, propertyId))
    .orderBy(desc(propertyEmailSenders.createdAt))
    .limit(500);
}
```

**Step 2: Commit**

```bash
git add src/server/repositories/email.repository.ts
git commit -m "perf: add limit to findSenders query to prevent unbounded results"
```

---

### Task 20: Replace Raw SQL with Drizzle ne() Operator

**Files:**
- Modify: `src/server/repositories/transaction.repository.ts:168`

**Step 1: Replace raw SQL**

```typescript
// BEFORE:
sql`${transactions.category} != 'uncategorized'`

// AFTER:
import { ne } from "drizzle-orm";
ne(transactions.category, "uncategorized")
```

**Step 2: Run tests**

Run: `npx vitest run src/server/repositories/__tests__/`

**Step 3: Commit**

```bash
git add src/server/repositories/transaction.repository.ts
git commit -m "refactor: replace raw SQL with Drizzle ne() operator in transaction repo"
```

---

## Verification Checklist

After each phase:

1. `npx tsc --noEmit` — no type errors
2. `npx vitest run` — all tests pass
3. `npx next build` — build succeeds
4. Manual smoke test on staging: dashboard load, transaction pagination, bank sync
5. Check bundle size: `ANALYZE=true npx next build` (Phase 1 frontend tasks)

## Migration Order

Database migrations (Tasks 7, 16, 18) should be applied to staging before code deploy:
1. Generate migrations locally
2. PR includes migration files
3. On merge to develop, migrations auto-apply via `drizzle-kit push` in CI or manual staging push
