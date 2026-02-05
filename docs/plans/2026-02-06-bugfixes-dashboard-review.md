# Bug Fixes & Dashboard Feature Review Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix P0-P1 bugs (N+1 queries, fire-and-forget errors, landing screenshots) then do a live testing review of every dashboard feature.

**Architecture:** Three targeted bug fixes in server routers, then systematic browser-based QA of all 21 dashboard feature areas with a findings report.

**Tech Stack:** Next.js 16, tRPC, Drizzle ORM, Playwright (for live testing), PostgreSQL

---

## Part 1: Bug Fixes

### Task 1: Fix N+1 query in forecast.ts — batch INSERT

**Files:**
- Modify: `src/server/routers/forecast.ts:289-313`

**Step 1: Collect forecast values into array, then bulk insert**

Replace the loop that does 12 individual `db.insert()` calls with a single batch insert:

```typescript
// Before (12 individual inserts):
for (let month = 0; month < 12; month++) {
  const projection = calculateMonthlyProjection({...});
  await db.insert(cashFlowForecasts).values({ ... });
}

// After (single batch insert):
const forecastValues = [];
for (let month = 0; month < 12; month++) {
  const projection = calculateMonthlyProjection({
    monthsAhead: month,
    baseIncome,
    baseExpenses,
    loanBalance: totalLoanBalance,
    loanRate: weightedRate,
    assumptions,
  });
  forecastValues.push({
    userId,
    scenarioId,
    propertyId: null,
    forecastMonth: getForecastMonth(month),
    projectedIncome: String(projection.projectedIncome),
    projectedExpenses: String(projection.projectedExpenses),
    projectedNet: String(projection.projectedNet),
    breakdown: JSON.stringify({
      baseIncome,
      baseExpenses,
      loanInterest: projection.projectedExpenses - baseExpenses,
    }),
  });
}
await db.insert(cashFlowForecasts).values(forecastValues);
```

**Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no type errors in forecast.ts

**Step 3: Commit**

```bash
git add src/server/routers/forecast.ts
git commit -m "perf: batch forecast inserts (12 queries → 1)"
```

---

### Task 2: Fix N+1 query in recurring.ts — batch updates

**Files:**
- Modify: `src/server/routers/recurring.ts:423-456`

**Step 1: Collect updates, then batch execute**

Replace sequential updates inside the loop:

```typescript
// Collect all updates
const expectedUpdates: { id: string; matchedTransactionId: string }[] = [];
const transactionUpdates: { id: string; category: string; transactionType: string; propertyId: string }[] = [];

for (const expected of pending) {
  if (!expected.recurringTransaction) continue;
  // ... matching logic stays the same ...
  if (matches.length > 0 && matches[0].confidence === "high") {
    expectedUpdates.push({
      id: expected.id,
      matchedTransactionId: matches[0].transaction.id,
    });
    transactionUpdates.push({
      id: matches[0].transaction.id,
      category: expected.recurringTransaction.category,
      transactionType: expected.recurringTransaction.transactionType,
      propertyId: expected.propertyId,
    });
  }
}

// Batch update expected transactions
if (expectedUpdates.length > 0) {
  await Promise.all(expectedUpdates.map(u =>
    ctx.db.update(expectedTransactions)
      .set({ status: "matched", matchedTransactionId: u.matchedTransactionId })
      .where(eq(expectedTransactions.id, u.id))
  ));
}

// Batch update actual transactions
if (transactionUpdates.length > 0) {
  await Promise.all(transactionUpdates.map(u =>
    ctx.db.update(transactions)
      .set({
        category: u.category,
        transactionType: u.transactionType,
        propertyId: u.propertyId,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, u.id))
  ));
}
```

Note: Read the actual code first — the above is a template based on the bead description. Adapt to match exact variable names and types.

**Step 2: Verify the app builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/server/routers/recurring.ts
git commit -m "perf: batch recurring transaction updates"
```

---

### Task 3: Fix N+1 query in portfolio.ts — SQL DISTINCT ON

**Files:**
- Modify: `src/server/routers/portfolio.ts:62-76`

**Step 1: Replace fetch-all-then-filter with SQL query**

Replace the pattern that fetches all property values then filters in JS:

```typescript
// Before: fetch ALL values, filter in memory
const allValues = await ctx.db.query.propertyValues.findMany({
  where: and(
    eq(propertyValues.userId, ctx.portfolio.ownerId),
    inArray(propertyValues.propertyId, propertyIds)
  ),
  orderBy: [desc(propertyValues.valueDate)],
});
const latestValues = new Map<string, number>();
for (const v of allValues) {
  if (!latestValues.has(v.propertyId)) {
    latestValues.set(v.propertyId, Number(v.estimatedValue));
  }
}

// After: use SQL subquery to fetch only latest per property
import { sql } from "drizzle-orm";

const latestValueRows = await ctx.db.execute(sql`
  SELECT DISTINCT ON (property_id)
    property_id, estimated_value, value_date
  FROM property_values
  WHERE user_id = ${ctx.portfolio.ownerId}
    AND property_id = ANY(${propertyIds})
  ORDER BY property_id, value_date DESC
`);
const latestValues = new Map<string, number>();
for (const v of latestValueRows.rows) {
  latestValues.set(v.property_id as string, Number(v.estimated_value));
}
```

Note: Read the actual code first — verify column names match the schema. If Drizzle's query builder supports window functions via subquery, prefer that over raw SQL for type safety.

**Step 2: Verify the app builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/server/routers/portfolio.ts
git commit -m "perf: use DISTINCT ON for latest property values"
```

---

### Task 4: Fix fire-and-forget in documentExtraction.ts

**Files:**
- Modify: `src/server/routers/documentExtraction.ts:48-113`

**Step 1: Replace .then().catch() with proper async/await and logging**

The fire-and-forget pattern uses `ctx.db` which may be destroyed after request ends. Fix by:
1. Capturing a standalone db connection reference
2. Adding proper error logging
3. Adding a final safety catch

```typescript
// Before: fire-and-forget with .then().catch()
extractDocument(document.storagePath, document.fileType)
  .then(async (result) => { ... })
  .catch(async (error) => { ... });

// After: proper async handling with captured db reference
// Capture db reference before async gap
const db = ctx.db;
const extractionId = extraction.id;

// Use void + catch to handle background work properly
void (async () => {
  try {
    const result = await extractDocument(document.storagePath, document.fileType);
    if (!result.success || !result.data) {
      await db.update(documentExtractions)
        .set({
          status: "failed",
          error: result.error || "Extraction failed",
          completedAt: new Date(),
        })
        .where(eq(documentExtractions.id, extractionId));
      return;
    }
    // ... rest of success path (property matching, transaction creation)
    await db.update(documentExtractions).set({
      status: "completed",
      // ... fields
      completedAt: new Date(),
    }).where(eq(documentExtractions.id, extractionId));
  } catch (error) {
    console.error("[documentExtraction] Background extraction failed:", error);
    try {
      await db.update(documentExtractions)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(documentExtractions.id, extractionId));
    } catch (dbError) {
      console.error("[documentExtraction] Failed to update extraction status:", dbError);
    }
  }
})();
```

**Step 2: Verify the app builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/server/routers/documentExtraction.ts
git commit -m "fix: proper async error handling in document extraction"
```

---

### Task 5: Fix fire-and-forget in documents.ts

**Files:**
- Modify: `src/server/routers/documents.ts:211-292`

**Step 1: Apply same pattern as Task 4**

Same fix: capture db reference, use void async IIFE with try/catch, add error logging.

**Step 2: Verify the app builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/server/routers/documents.ts
git commit -m "fix: proper async error handling in documents router"
```

---

### Task 6: Fix any types in forecast.ts (P2 bonus)

**Files:**
- Modify: `src/server/routers/forecast.ts`

**Step 1: Find all `any` types and replace with proper types**

Search for `: any` and `as any` in forecast.ts. Replace each with the correct type based on the Drizzle schema and function signatures.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/server/routers/forecast.ts
git commit -m "fix: replace any types in forecast.ts with proper types"
```

---

## Part 2: Dashboard Feature Review (Live Testing)

### Task 7: Start dev server and prepare for QA

**Step 1: Start the dev server**

Run: `npm run dev`

Verify: Server starts on http://localhost:3000

**Step 2: Open browser and verify auth flow works**

Navigate to http://localhost:3000 → should redirect to sign-in or show landing page.

---

### Task 8: Systematic dashboard QA

For each of the following 21 areas, test in the browser and record findings:

**Testing checklist per feature:**
- [ ] Page loads without errors (check console)
- [ ] Data displays correctly
- [ ] Loading states work (skeleton/spinner)
- [ ] Error states handled (disconnect network, invalid data)
- [ ] Empty states shown when no data
- [ ] Forms submit correctly
- [ ] Navigation works (links, back button)
- [ ] Mobile responsive (resize viewport)

**Features to test:**
1. Main Dashboard — stats cards, widgets, onboarding wizard
2. Discover — filters, view modes, saved listings
3. Alerts — anomaly list, dismiss, filter
4. Portfolio — equity summary, card/table/aggregate views, sorting
5. Properties — list, add/edit/delete, detail page, sub-pages
6. Transactions — table, categorization, bulk ops, pagination
7. Transaction Review — AI suggestions, accept/reject
8. Reports hub — all 8 report types render
9. Tax Position — calculator, deductions
10. Forecast / Scenarios — chart, scenario CRUD
11. CGT — cost base, record sale
12. MyTax Export — checklist, ATO alignment
13. Banking — connections list, sync, reconnect
14. Loans — list, add/edit, comparison
15. Emails — inbox, threading, approve/reject
16. Tasks — list/kanban views, CRUD, drag-and-drop
17. Entities — list, CRUD, compliance
18. Export — CSV download, filters
19. Settings — billing, team, integrations, notifications
20. AI Chat — opens, sends messages, responses
21. Sidebar/Navigation — all links work, collapse, entity/portfolio switcher

**Step 3: Record all findings**

Write findings to `docs/plans/2026-02-06-dashboard-qa-findings.md` with:
- Feature name
- Status: PASS / ISSUE / BLOCKED
- Description of any issues found
- Screenshot paths if relevant
- Severity: Critical / Major / Minor / Cosmetic

**Step 4: Commit findings**

```bash
git add docs/plans/2026-02-06-dashboard-qa-findings.md
git commit -m "docs: dashboard QA findings report"
```

---

### Task 9: Create follow-up tasks from QA findings

**Step 1: For each ISSUE found in Task 8, create a bead task**

```bash
bd create "Fix: <description>" -p <priority>
```

Priority guide:
- P0: App crashes or data loss
- P1: Feature broken or major UX issue
- P2: Minor bug or cosmetic issue
- P3: Nice-to-have improvement

**Step 2: Commit and notify**

```bash
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "Dashboard QA complete. X issues found. See docs/plans/2026-02-06-dashboard-qa-findings.md" \
  -H "Title: Claude Code" \
  -H "Priority: high"
```
