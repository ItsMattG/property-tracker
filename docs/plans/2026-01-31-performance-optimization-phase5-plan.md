# Performance Optimization Phase 5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix remaining performance issues: remove unnecessary force-dynamic, optimize SQL queries, reduce O(n²) complexity, and add query caching.

**Architecture:** Database-level aggregations replace in-memory filtering; Map-based pre-indexing for O(1) lookups; staleTime on React Query hooks to reduce refetches.

**Tech Stack:** Next.js 15, tRPC, Drizzle ORM, React Query

---

## Task 1: Remove force-dynamic from Root Layout

**Files:**
- Modify: `src/app/layout.tsx:21-22`

**Step 1: Remove the force-dynamic export**

Delete lines 21-22:
```tsx
// DELETE THESE LINES:
// Skip static generation - app uses Clerk auth
export const dynamic = "force-dynamic";
```

The dashboard layout already has its own `force-dynamic` for authenticated pages. Public pages (landing, blog, changelog) already have their own `revalidate` settings.

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "perf: remove force-dynamic from root layout

Dashboard layout already has force-dynamic for auth pages.
Public pages have their own revalidate settings.
This allows better caching of public routes."
```

---

## Task 2: Optimize anomaly.getActiveCount with SQL Aggregation

**Files:**
- Modify: `src/server/routers/anomaly.ts:4,68-83`

**Step 1: Add sql import**

At line 4, add `sql` to the import:
```typescript
import { eq, and, desc, inArray, sql } from "drizzle-orm";
```

**Step 2: Replace in-memory filtering with SQL aggregation**

Replace lines 68-83:
```typescript
  getActiveCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'critical')::int`,
        warning: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'warning')::int`,
        info: sql<number>`count(*) filter (where ${anomalyAlerts.severity} = 'info')::int`,
      })
      .from(anomalyAlerts)
      .where(
        and(
          eq(anomalyAlerts.userId, ctx.portfolio.ownerId),
          eq(anomalyAlerts.status, "active")
        )
      );

    return {
      total: result[0]?.total ?? 0,
      critical: result[0]?.critical ?? 0,
      warning: result[0]?.warning ?? 0,
      info: result[0]?.info ?? 0,
    };
  }),
```

**Step 3: Run tests**

Run: `npm run test -- --grep anomaly`
Expected: Tests pass

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/routers/anomaly.ts
git commit -m "perf: use SQL aggregation for anomaly count

Replaces in-memory filtering with SQL COUNT FILTER.
Single query returns all counts instead of fetching all rows."
```

---

## Task 3: Optimize compliance.getPortfolioCompliance with Map Pre-indexing

**Files:**
- Modify: `src/server/routers/compliance.ts:116-136`

**Step 1: Pre-index records by propertyId and cache requirements by state**

Replace lines 107-136 (inside getPortfolioCompliance):
```typescript
    // Build compliance items for all properties
    const allItems: Array<{
      propertyId: string;
      propertyAddress: string;
      requirement: { id: string; name: string };
      nextDueAt: string;
      status: ReturnType<typeof calculateComplianceStatus>;
    }> = [];

    // Pre-index records by propertyId for O(1) lookup
    const recordsByProperty = new Map<string, typeof allRecords>();
    for (const record of allRecords) {
      const existing = recordsByProperty.get(record.propertyId) ?? [];
      existing.push(record);
      recordsByProperty.set(record.propertyId, existing);
    }

    // Cache requirements by state to avoid redundant calls
    const requirementsByState = new Map<string, ReturnType<typeof getRequirementsForState>>();

    for (const property of userProperties) {
      // Get cached requirements or fetch and cache
      let requirements = requirementsByState.get(property.state);
      if (!requirements) {
        requirements = getRequirementsForState(property.state as AustralianState);
        requirementsByState.set(property.state, requirements);
      }

      // O(1) lookup instead of O(n) filter
      const propertyRecords = recordsByProperty.get(property.id) ?? [];

      // Pre-index property records by requirementId for O(1) lookup
      const recordsByRequirement = new Map<string, typeof allRecords[0]>();
      for (const record of propertyRecords) {
        // Keep most recent (already sorted by nextDueAt desc)
        if (!recordsByRequirement.has(record.requirementId)) {
          recordsByRequirement.set(record.requirementId, record);
        }
      }

      for (const requirement of requirements) {
        const lastRecord = recordsByRequirement.get(requirement.id);

        if (lastRecord) {
          const nextDueAt = new Date(lastRecord.nextDueAt);
          const status = calculateComplianceStatus(nextDueAt);

          allItems.push({
            propertyId: property.id,
            propertyAddress: property.address,
            requirement: { id: requirement.id, name: requirement.name },
            nextDueAt: nextDueAt.toISOString(),
            status,
          });
        }
      }
    }
```

**Step 2: Run tests**

Run: `npm run test -- --grep compliance`
Expected: Tests pass

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/routers/compliance.ts
git commit -m "perf: optimize compliance query with Map pre-indexing

Reduces O(n*m) complexity to O(n+m) by:
- Pre-indexing records by propertyId
- Caching requirements by state
- Pre-indexing property records by requirementId"
```

---

## Task 4: Add staleTime to Portfolio Page Queries

**Files:**
- Modify: `src/app/(dashboard)/portfolio/page.tsx:47-59`

**Step 1: Add staleTime to getPropertyMetrics query**

Change line 47-53:
```typescript
  const { data: metrics, isLoading, refetch } = trpc.portfolio.getPropertyMetrics.useQuery(
    {
      period,
      sortBy,
      sortOrder: "desc",
      state: stateFilter,
      status: statusFilter as "active" | "sold" | undefined,
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );
```

**Step 2: Add staleTime to getSummary query**

Change line 55-59:
```typescript
  const { data: summary } = trpc.portfolio.getSummary.useQuery(
    {
      period,
      state: stateFilter,
      status: statusFilter as "active" | "sold" | undefined,
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/(dashboard)/portfolio/page.tsx
git commit -m "perf: add staleTime to portfolio queries

Reduces unnecessary refetches with 5-minute cache.
Data changes infrequently enough that this won't affect UX."
```

---

## Task 5: Add staleTime to Properties Page Query

**Files:**
- Modify: `src/app/(dashboard)/properties/page.tsx:10`

**Step 1: Add staleTime to property.list query**

Change line 10:
```typescript
  const { data: properties, isLoading, refetch } = trpc.property.list.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/properties/page.tsx
git commit -m "perf: add staleTime to properties list query

Reduces unnecessary refetches with 5-minute cache."
```

---

## Task 6: Final Verification

**Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

---

## Summary

| Task | Description | Impact |
|------|-------------|--------|
| 1 | Remove force-dynamic from root layout | Better caching for public pages |
| 2 | SQL aggregation for anomaly counts | 1 query vs fetching all rows |
| 3 | Map pre-indexing for compliance | O(n+m) vs O(n*m) |
| 4 | Portfolio page staleTime | Reduces refetches |
| 5 | Properties page staleTime | Reduces refetches |
| 6 | Final verification | Ensures no regressions |

**Total tasks:** 6
**Estimated commits:** 5

---

Plan complete and saved to `docs/plans/2026-01-31-performance-optimization-phase5-plan.md`.
