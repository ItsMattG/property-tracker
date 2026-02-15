# Dashboard DISTINCT ON Regression Test Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add regression test coverage for the dashboard's `selectDistinctOn` property value queries that caused a production 500.

**Architecture:** Extract dashboard's inline DISTINCT ON logic to reuse portfolio's `getLatestPropertyValues` helper (with optional `beforeDate` param), then add unit tests with mocked DB and integration tests against real Postgres.

**Tech Stack:** Vitest, Drizzle ORM (`selectDistinctOn`), postgres.js, tRPC test caller

---

### Task 1: Add `beforeDate` parameter to `getLatestPropertyValues` and export it

**Files:**
- Modify: `src/server/routers/portfolio.ts:14-41`

**Step 1: Write the failing test**

Create `src/server/routers/__tests__/getLatestPropertyValues.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

// We'll test that the function exists and accepts beforeDate
// For now just verify the export works
describe("getLatestPropertyValues", () => {
  it("is exported from portfolio helpers", async () => {
    const mod = await import("../portfolio-helpers");
    expect(mod.getLatestPropertyValues).toBeDefined();
    expect(typeof mod.getLatestPropertyValues).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routers/__tests__/getLatestPropertyValues.test.ts`
Expected: FAIL — module `../portfolio-helpers` does not exist

**Step 3: Extract helper to new file**

Create `src/server/routers/portfolio-helpers.ts`:

```ts
import { propertyValues } from "../db/schema";
import { eq, and, lt, inArray, desc } from "drizzle-orm";

type DrizzleDb = typeof import("../db")["db"];

/** Fetch the latest property value per property using DISTINCT ON.
 *  Optional `beforeDate` filters to values before that date (for period comparisons). */
export async function getLatestPropertyValues(
  db: DrizzleDb,
  userId: string,
  propertyIds: string[],
  beforeDate?: string
): Promise<Map<string, number>> {
  if (propertyIds.length === 0) return new Map();

  const conditions = [
    eq(propertyValues.userId, userId),
    inArray(propertyValues.propertyId, propertyIds),
  ];
  if (beforeDate) {
    conditions.push(lt(propertyValues.valueDate, beforeDate));
  }

  const rows = await db
    .selectDistinctOn([propertyValues.propertyId], {
      propertyId: propertyValues.propertyId,
      estimatedValue: propertyValues.estimatedValue,
    })
    .from(propertyValues)
    .where(and(...conditions))
    .orderBy(
      propertyValues.propertyId,
      desc(propertyValues.valueDate),
      desc(propertyValues.createdAt)
    );

  const latestValues = new Map<string, number>();
  for (const row of rows) {
    latestValues.set(row.propertyId, Number(row.estimatedValue));
  }
  return latestValues;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/routers/__tests__/getLatestPropertyValues.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routers/portfolio-helpers.ts src/server/routers/__tests__/getLatestPropertyValues.test.ts
git commit -m "refactor: extract getLatestPropertyValues to shared helper"
```

---

### Task 2: Wire portfolio.ts to use shared helper

**Files:**
- Modify: `src/server/routers/portfolio.ts:1-41`

**Step 1: Run existing portfolio tests as baseline**

Run: `npx vitest run src/server/routers/__tests__/portfolio.test.ts`
Expected: PASS (all 5 existing tests)

**Step 2: Replace inline helper with import**

In `src/server/routers/portfolio.ts`, replace lines 14-41 (the `getLatestPropertyValues` function definition) with:

```ts
import { getLatestPropertyValues } from "./portfolio-helpers";
```

Remove `desc` from the drizzle-orm import if it's no longer used directly (check other usages first).

**Step 3: Run portfolio tests again**

Run: `npx vitest run src/server/routers/__tests__/portfolio.test.ts`
Expected: PASS (same 5 tests, behavior unchanged)

**Step 4: Commit**

```bash
git add src/server/routers/portfolio.ts
git commit -m "refactor: portfolio.ts uses shared getLatestPropertyValues"
```

---

### Task 3: Wire dashboard.ts to use shared helper

**Files:**
- Modify: `src/server/routers/dashboard.ts:9,12,218-264`

**Step 1: Replace dashboard's inline DISTINCT ON queries**

In `src/server/routers/dashboard.ts`:

1. Add import at top:
```ts
import { getLatestPropertyValues } from "./portfolio-helpers";
```

2. Remove `propertyValues` from the schema import (line 9) — it's no longer used directly.

3. Remove `desc` from drizzle-orm import (line 12) if no longer needed — check other usages first.

4. Replace lines 217-244 (current values block) with:
```ts
          if (activePropertyIds.length > 0) {
            // Current: latest estimated_value per active property (DISTINCT ON)
            const valuationMap = await getLatestPropertyValues(
              ctx.db, userId, activePropertyIds
            );
            currentPortfolioValue = activeProperties.reduce(
              (sum, p) => sum + (valuationMap.get(p.id) || parseFloat(p.purchasePrice || "0")),
              0
            );

            // Previous: latest value per property before start of current month
            const prevValuationMap = await getLatestPropertyValues(
              ctx.db, userId, activePropertyIds, currentMonthStr
            );
```

5. Replace lines 266-278 (previous values block — the part after prevValuationMap is built) — keep the `propertiesBeforeMonth` logic:
```ts
            const propertiesBeforeMonth = activeProperties.filter(p => p.createdAt < startOfMonth);
            if (propertiesBeforeMonth.length > 0) {
              previousPortfolioValue = propertiesBeforeMonth.reduce(
                (sum, p) => sum + (prevValuationMap.get(p.id) || parseFloat(p.purchasePrice || "0")),
                0
              );
            }
          }
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/server/routers/dashboard.ts
git commit -m "refactor: dashboard.ts uses shared getLatestPropertyValues"
```

---

### Task 4: Unit tests — dashboard.test.ts

**Files:**
- Create: `src/server/routers/__tests__/dashboard.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("dashboard router", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Properties created well before this month
  const lastYear = new Date(2025, 0, 1);
  const mockActiveProperties = [
    {
      id: "prop-1", userId: "user-1", address: "1 Main St", suburb: "Sydney",
      state: "NSW", postcode: "2000", purchasePrice: "500000",
      purchaseDate: "2020-01-01", entityName: "Personal", status: "active",
      createdAt: lastYear, updatedAt: lastYear,
    },
    {
      id: "prop-2", userId: "user-1", address: "2 Oak Ave", suburb: "Melbourne",
      state: "VIC", postcode: "3000", purchasePrice: "600000",
      purchaseDate: "2021-06-01", entityName: "Trust", status: "active",
      createdAt: lastYear, updatedAt: lastYear,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to build mock db that covers all getInitialData parallel queries
  function buildMockDb(overrides: {
    activeProperties?: typeof mockActiveProperties;
    currentValues?: { propertyId: string; estimatedValue: string }[];
    prevValues?: { propertyId: string; estimatedValue: string }[];
    loanDebt?: string;
  } = {}) {
    const props = overrides.activeProperties ?? mockActiveProperties;
    const currentVals = overrides.currentValues ?? [
      { propertyId: "prop-1", estimatedValue: "650000" },
      { propertyId: "prop-2", estimatedValue: "700000" },
    ];
    const prevVals = overrides.prevValues ?? currentVals;
    const debt = overrides.loanDebt ?? "700000";

    let selectDistinctOnCallCount = 0;

    return {
      selectDistinctOn: vi.fn().mockImplementation(() => {
        selectDistinctOnCallCount++;
        const vals = selectDistinctOnCallCount === 1 ? currentVals : prevVals;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(vals),
            }),
          }),
        };
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            // For count queries and loan debt query
            then: (resolve: any) => resolve([{ count: 0, total: debt }]),
          })),
        }),
      }),
      query: {
        users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
        properties: { findMany: vi.fn().mockResolvedValue(props) },
        connectionAlerts: { findMany: vi.fn().mockResolvedValue([]) },
        userOnboarding: { findFirst: vi.fn().mockResolvedValue({
          userId: "user-1", wizardDismissedAt: new Date(),
          checklistDismissedAt: new Date(), completedTours: [], toursDisabled: false,
        })},
      },
    };
  }

  describe("getInitialData — trends portfolio value", () => {
    it("returns correct portfolio value from DISTINCT ON results", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser as any });
      ctx.db = buildMockDb() as any;
      const caller = createTestCaller(ctx);
      const result = await caller.dashboard.getInitialData();

      // 650000 + 700000 = 1350000
      expect(result.trends.portfolioValue.current).toBe(1350000);
    });

    it("falls back to purchasePrice when no valuation exists", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser as any });
      ctx.db = buildMockDb({
        currentValues: [{ propertyId: "prop-1", estimatedValue: "650000" }],
        // prop-2 has no valuation — should fall back to purchasePrice 600000
      }) as any;
      const caller = createTestCaller(ctx);
      const result = await caller.dashboard.getInitialData();

      // 650000 + 600000 (fallback) = 1250000
      expect(result.trends.portfolioValue.current).toBe(1250000);
    });

    it("returns null previous when all properties created this month", async () => {
      const thisMonth = new Date();
      const newProps = mockActiveProperties.map(p => ({
        ...p, createdAt: thisMonth,
      }));
      const ctx = createMockContext({ userId: "user-1", user: mockUser as any });
      ctx.db = buildMockDb({ activeProperties: newProps }) as any;
      const caller = createTestCaller(ctx);
      const result = await caller.dashboard.getInitialData();

      expect(result.trends.portfolioValue.previous).toBeNull();
    });

    it("calculates equity as portfolioValue minus debt", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser as any });
      ctx.db = buildMockDb({ loanDebt: "400000" }) as any;
      const caller = createTestCaller(ctx);
      const result = await caller.dashboard.getInitialData();

      // value: 1350000, debt: 400000, equity: 950000
      expect(result.trends.totalEquity.current).toBe(950000);
    });

    it("handles empty property list without calling selectDistinctOn", async () => {
      const ctx = createMockContext({ userId: "user-1", user: mockUser as any });
      ctx.db = buildMockDb({ activeProperties: [] }) as any;
      // Override properties query to return empty
      ctx.db.query.properties.findMany = vi.fn().mockResolvedValue([]);
      const caller = createTestCaller(ctx);
      const result = await caller.dashboard.getInitialData();

      expect(result.trends.portfolioValue.current).toBe(0);
      expect(result.trends.portfolioValue.previous).toBeNull();
      expect(ctx.db.selectDistinctOn).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run the tests**

Run: `npx vitest run src/server/routers/__tests__/dashboard.test.ts`
Expected: Some tests may fail due to mock shape mismatches with the actual router code. Debug and fix mocks iteratively.

**Step 3: Get all tests passing**

Adjust mock structure to match the actual parallel Promise.all structure in `getInitialData`. The db mock needs to handle:
- `db.select().from(properties).where()` — for stats counts
- `db.select().from(transactions).where()` — for counts + trend counts
- `db.query.connectionAlerts.findMany()` — for alerts
- `db.query.userOnboarding.findFirst()` — for onboarding
- `db.select().from(propertyValues).where()` — for onboarding count
- `db.select().from(bankAccounts).where()` — for onboarding count
- `db.select().from(recurringTransactions).where()` — for onboarding count
- `db.query.properties.findMany()` — for property list
- `db.selectDistinctOn()` — for DISTINCT ON queries (2 calls)
- `db.select().from(loans).where()` — for debt

**Step 4: Commit**

```bash
git add src/server/routers/__tests__/dashboard.test.ts
git commit -m "test: add unit tests for dashboard DISTINCT ON portfolio value"
```

---

### Task 5: Integration test infrastructure

**Files:**
- Create: `src/server/__tests__/integration-utils.ts`

**Step 1: Create integration test utilities**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

/** Create a real Drizzle DB connection for integration tests.
 *  Returns { db, sql } — call sql.end() in afterAll. */
export function createIntegrationDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL required for integration tests");
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 10,
  });

  const db = drizzle(client, { schema });
  return { db, sql: client };
}

/** Unique test user ID prefix to avoid collisions */
export const TEST_USER_PREFIX = "test-integration-";

export function testUserId() {
  return `${TEST_USER_PREFIX}${crypto.randomUUID()}`;
}
```

**Step 2: Commit**

```bash
git add src/server/__tests__/integration-utils.ts
git commit -m "test: add integration test utilities for real DB tests"
```

---

### Task 6: Integration tests — DISTINCT ON queries

**Files:**
- Create: `src/server/routers/__tests__/dashboard.integration.test.ts`

**Step 1: Write the integration test file**

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createIntegrationDb, testUserId } from "../../__tests__/integration-utils";
import { getLatestPropertyValues } from "../portfolio-helpers";
import { users } from "../../db/schema/auth";
import { properties, propertyValues } from "../../db/schema/properties";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("getLatestPropertyValues — integration", () => {
  const { db, sql } = hasDb ? createIntegrationDb() : { db: null as any, sql: null as any };
  let userId: string;

  beforeAll(async () => {
    userId = testUserId();
    // Insert test user
    await db.insert(users).values({
      id: userId,
      name: "Integration Test User",
      email: `${userId}@test.example.com`,
      emailVerified: true,
    });
  });

  afterEach(async () => {
    // Clean up property values and properties after each test
    await db.delete(propertyValues).where(eq(propertyValues.userId, userId));
    await db.delete(properties).where(eq(properties.userId, userId));
  });

  afterAll(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.id, userId));
    await sql.end();
  });

  it("returns only the latest value per property (DISTINCT ON)", async () => {
    // Insert 2 properties
    const [prop1] = await db.insert(properties).values({
      userId,
      address: "1 Test St",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      purchasePrice: "500000",
      purchaseDate: "2020-01-01",
    }).returning();

    // Insert 3 valuations for prop1 — only latest should be returned
    await db.insert(propertyValues).values([
      { propertyId: prop1.id, userId, estimatedValue: "500000", valueDate: "2025-01-01", source: "manual" },
      { propertyId: prop1.id, userId, estimatedValue: "550000", valueDate: "2025-06-01", source: "manual" },
      { propertyId: prop1.id, userId, estimatedValue: "600000", valueDate: "2026-01-01", source: "manual" },
    ]);

    const result = await getLatestPropertyValues(db, userId, [prop1.id]);

    expect(result.size).toBe(1);
    expect(result.get(prop1.id)).toBe(600000); // Latest
  });

  it("handles multiple properties with inArray binding (regression)", async () => {
    // Insert 3+ properties — the original bug was ANY parameter binding with multiple IDs
    const inserted = await db.insert(properties).values([
      { userId, address: "1 Test St", suburb: "Sydney", state: "NSW", postcode: "2000", purchasePrice: "500000", purchaseDate: "2020-01-01" },
      { userId, address: "2 Test St", suburb: "Melbourne", state: "VIC", postcode: "3000", purchasePrice: "600000", purchaseDate: "2020-01-01" },
      { userId, address: "3 Test St", suburb: "Brisbane", state: "QLD", postcode: "4000", purchasePrice: "700000", purchaseDate: "2020-01-01" },
    ]).returning();

    const ids = inserted.map(p => p.id);

    // Insert one valuation per property
    await db.insert(propertyValues).values(
      inserted.map(p => ({
        propertyId: p.id, userId, estimatedValue: "800000",
        valueDate: "2026-01-01", source: "manual" as const,
      }))
    );

    // This should NOT throw — the original bug caused a 500 here
    const result = await getLatestPropertyValues(db, userId, ids);

    expect(result.size).toBe(3);
    for (const id of ids) {
      expect(result.get(id)).toBe(800000);
    }
  });

  it("filters by beforeDate correctly", async () => {
    const [prop] = await db.insert(properties).values({
      userId,
      address: "1 Filter St",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      purchasePrice: "500000",
      purchaseDate: "2020-01-01",
    }).returning();

    await db.insert(propertyValues).values([
      { propertyId: prop.id, userId, estimatedValue: "500000", valueDate: "2025-06-01", source: "manual" },
      { propertyId: prop.id, userId, estimatedValue: "600000", valueDate: "2026-01-15", source: "manual" },
      { propertyId: prop.id, userId, estimatedValue: "700000", valueDate: "2026-02-01", source: "manual" },
    ]);

    // Without filter: should return latest (700000)
    const all = await getLatestPropertyValues(db, userId, [prop.id]);
    expect(all.get(prop.id)).toBe(700000);

    // With beforeDate Feb 2026: should return Jan value (600000)
    const before = await getLatestPropertyValues(db, userId, [prop.id], "2026-02-01");
    expect(before.get(prop.id)).toBe(600000);
  });

  it("returns empty map when no property values exist", async () => {
    const [prop] = await db.insert(properties).values({
      userId,
      address: "1 Empty St",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      purchasePrice: "500000",
      purchaseDate: "2020-01-01",
    }).returning();

    const result = await getLatestPropertyValues(db, userId, [prop.id]);
    expect(result.size).toBe(0);
  });
});
```

**Step 2: Run integration tests locally**

Run: `npx vitest run src/server/routers/__tests__/dashboard.integration.test.ts`
Expected: PASS (if DATABASE_URL is set and DB is running), SKIP (if not)

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/dashboard.integration.test.ts
git commit -m "test: add integration tests for DISTINCT ON property value query"
```

---

### Task 7: Final validation

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All pass, including new dashboard tests and existing portfolio tests

**Step 2: Run integration tests**

Run: `npx vitest run --reporter=verbose src/server/routers/__tests__/dashboard.integration.test.ts`
Expected: PASS (4 integration tests)

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "test: fixups for dashboard regression test suite"
```

**Step 5: Create PR**

```bash
gh pr create --base develop --title "test: dashboard DISTINCT ON regression tests" --body "..."
```
