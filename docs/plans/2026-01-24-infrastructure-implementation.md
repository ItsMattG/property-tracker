# Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish CI/CD pipeline, testing framework, monitoring, and performance optimizations as the foundation for all future development.

**Architecture:** GitHub Actions for CI (lint, type-check, test, build), Vercel for deployment with preview environments, Sentry for error tracking, Vitest for unit tests alongside existing Playwright E2E tests.

**Tech Stack:** GitHub Actions, Vercel, Sentry, Vitest, react-virtual (for performance)

---

## Task 1: Set Up Vitest for Unit Testing

**Files:**
- Create: `vitest.config.ts`
- Create: `src/server/services/__tests__/csv-import.test.ts`
- Modify: `package.json`

**Step 1: Install Vitest dependencies**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Expected: Dependencies added to package.json devDependencies

**Step 2: Create Vitest configuration**

Create file `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "e2e/", "*.config.*"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 3: Create Vitest setup file**

Create file `vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

**Step 4: Add test scripts to package.json**

In `package.json`, add to "scripts":
```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:e2e"
  }
}
```

Note: Rename existing "test" to "test:e2e" and add new scripts.

**Step 5: Write first unit test for CSV import**

Create file `src/server/services/__tests__/csv-import.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseCSV } from "../csv-import";

describe("parseCSV", () => {
  it("parses standard CSV with Date, Description, Amount columns", () => {
    const csv = `Date,Description,Amount
15/01/2026,Rent payment,2400.00
16/01/2026,Water bill,-85.50`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2026-01-15",
      description: "Rent payment",
      amount: 2400.0,
    });
    expect(result[1]).toEqual({
      date: "2026-01-16",
      description: "Water bill",
      amount: -85.5,
    });
  });

  it("handles Debit/Credit columns instead of Amount", () => {
    const csv = `Date,Description,Debit,Credit
15/01/2026,Rent payment,,2400.00
16/01/2026,Water bill,85.50,`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(2400.0);
    expect(result[1].amount).toBe(-85.5);
  });

  it("handles YYYY-MM-DD date format", () => {
    const csv = `Date,Description,Amount
2026-01-15,Rent payment,2400.00`;

    const result = parseCSV(csv);

    expect(result[0].date).toBe("2026-01-15");
  });

  it("handles DD-MM-YYYY date format", () => {
    const csv = `Date,Description,Amount
15-01-2026,Rent payment,2400.00`;

    const result = parseCSV(csv);

    expect(result[0].date).toBe("2026-01-15");
  });

  it("returns empty array for empty CSV", () => {
    const csv = `Date,Description,Amount`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(0);
  });

  it("skips rows with missing required fields", () => {
    const csv = `Date,Description,Amount
15/01/2026,Rent payment,2400.00
,Missing date,100.00
15/01/2026,,100.00`;

    const result = parseCSV(csv);

    expect(result).toHaveLength(1);
  });
});
```

**Step 6: Run unit tests to verify setup**

Run:
```bash
npm run test:unit
```

Expected: All tests pass (6 tests)

**Step 7: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json src/server/services/__tests__/
git commit -m "feat: add Vitest unit testing framework with CSV import tests"
```

---

## Task 2: Add Unit Tests for tRPC Permission Checks

**Files:**
- Create: `src/server/routers/__tests__/property.test.ts`
- Create: `src/server/__tests__/test-utils.ts`

**Step 1: Create test utilities for tRPC**

Create file `src/server/__tests__/test-utils.ts`:
```typescript
import { createTRPCContext } from "../trpc";
import { appRouter } from "../routers/_app";

type MockUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createMockContext(overrides: {
  clerkId?: string | null;
  user?: MockUser | null;
} = {}) {
  return {
    db: {} as any, // Will be mocked per test
    clerkId: overrides.clerkId ?? null,
    user: overrides.user ?? null,
  };
}

export function createTestCaller(ctx: ReturnType<typeof createMockContext>) {
  return appRouter.createCaller(ctx as any);
}
```

**Step 2: Write permission tests for property router**

Create file `src/server/routers/__tests__/property.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("property router", () => {
  describe("authentication", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createMockContext({ clerkId: null });
      const caller = createTestCaller(ctx);

      await expect(caller.property.list()).rejects.toThrow(TRPCError);
      await expect(caller.property.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws UNAUTHORIZED when user not found in database", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123" });
      // Mock db.query.users.findFirst to return null
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };
      const caller = createTestCaller(ctx);

      await expect(caller.property.list()).rejects.toThrow(TRPCError);
      await expect(caller.property.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: expect.stringContaining("User not found"),
      });
    });
  });

  describe("data isolation", () => {
    const mockUser = {
      id: "user-1",
      clerkId: "clerk_123",
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const otherUser = {
      id: "user-2",
      clerkId: "clerk_456",
      email: "other@example.com",
      name: "Other User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("property.get throws NOT_FOUND for other user's property", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
          properties: {
            findFirst: vi.fn().mockResolvedValue(null), // Property belongs to other user
          },
        },
      };
      const caller = createTestCaller(ctx);

      await expect(
        caller.property.get({ id: "other-users-property" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("property.list only returns current user's properties", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });
      const userProperties = [
        { id: "prop-1", userId: "user-1", address: "123 Main St" },
        { id: "prop-2", userId: "user-1", address: "456 Oak Ave" },
      ];

      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(mockUser),
          },
          properties: {
            findMany: vi.fn().mockResolvedValue(userProperties),
          },
        },
      };
      const caller = createTestCaller(ctx);

      const result = await caller.property.list();

      expect(result).toHaveLength(2);
      expect(result.every((p: any) => p.userId === "user-1")).toBe(true);
    });
  });
});
```

**Step 3: Run tests**

Run:
```bash
npm run test:unit
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/__tests__/ src/server/routers/__tests__/
git commit -m "test: add unit tests for tRPC authentication and data isolation"
```

---

## Task 3: Set Up GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create GitHub Actions workflow directory**

Run:
```bash
mkdir -p .github/workflows
```

**Step 2: Create CI workflow file**

Create file `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: "20"

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript type check
        run: npx tsc --noEmit

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, unit-tests]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          # Provide dummy env vars for build (no runtime needed)
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_dummy
          CLERK_SECRET_KEY: sk_test_dummy
          DATABASE_URL: postgresql://dummy:dummy@localhost:5432/dummy

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [build]
    # Only run E2E on main branch or when PR is ready
    if: github.event_name == 'push' || github.event.pull_request.draft == false

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
          E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow for lint, test, and build"
```

---

## Task 4: Set Up Sentry Error Tracking

**Files:**
- Modify: `package.json`
- Create: `src/lib/sentry.ts`
- Modify: `src/app/layout.tsx`
- Create: `src/app/global-error.tsx`
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`

**Step 1: Install Sentry SDK**

Run:
```bash
npm install @sentry/nextjs
```

Expected: @sentry/nextjs added to dependencies

**Step 2: Create Sentry client configuration**

Create file `sentry.client.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay for error context
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
  ],
});
```

**Step 3: Create Sentry server configuration**

Create file `sentry.server.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  // Capture unhandled promise rejections
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ["error"],
    }),
  ],
});
```

**Step 4: Create Sentry edge configuration**

Create file `sentry.edge.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,
});
```

**Step 5: Create global error boundary**

Create file `src/app/global-error.tsx`:
```typescript
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-gray-600 mb-4">
            We've been notified and are working on a fix.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

**Step 6: Update next.config.ts for Sentry**

Read the current `next.config.ts` first, then modify it:

Modify `next.config.ts` to wrap with Sentry:
```typescript
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Your existing config here
};

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in CI
  silent: !process.env.CI,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Hide source maps from client bundles
  hideSourceMaps: true,

  // Tree shake Sentry from client bundles when not needed
  disableLogger: true,
});
```

**Step 7: Add Sentry environment variables to .env.local.example**

Add to `.env.local.example`:
```
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=property-tracker
SENTRY_AUTH_TOKEN=sntrys_xxx
```

**Step 8: Commit**

```bash
git add sentry.*.config.ts src/app/global-error.tsx next.config.ts .env.local.example package.json package-lock.json
git commit -m "feat: add Sentry error tracking and monitoring"
```

---

## Task 5: Add Server-Side Pagination to Transactions

**Files:**
- Modify: `src/server/routers/transaction.ts`
- Create: `src/server/routers/__tests__/transaction.test.ts`

**Step 1: Write failing test for pagination**

Create file `src/server/routers/__tests__/transaction.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { createMockContext, createTestCaller } from "../../__tests__/test-utils";

describe("transaction router", () => {
  describe("list pagination", () => {
    const mockUser = {
      id: "user-1",
      clerkId: "clerk_123",
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("returns paginated results with total count", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const allTransactions = Array.from({ length: 150 }, (_, i) => ({
        id: `tx-${i}`,
        userId: "user-1",
        date: new Date(),
        description: `Transaction ${i}`,
        amount: 100,
      }));

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: {
            findMany: vi.fn().mockImplementation(({ limit, offset }) =>
              allTransactions.slice(offset, offset + limit)
            ),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 150 }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.list({ limit: 50, offset: 0 });

      expect(result.transactions).toHaveLength(50);
      expect(result.total).toBe(150);
      expect(result.hasMore).toBe(true);
    });

    it("returns hasMore: false on last page", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: {
            findMany: vi.fn().mockResolvedValue([
              { id: "tx-1", userId: "user-1" },
              { id: "tx-2", userId: "user-1" },
            ]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 52 }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.list({ limit: 50, offset: 50 });

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(52);
      expect(result.hasMore).toBe(false);
    });

    it("defaults to limit 50 and offset 0", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123", user: mockUser });

      const findManyMock = vi.fn().mockResolvedValue([]);
      ctx.db = {
        query: {
          users: { findFirst: vi.fn().mockResolvedValue(mockUser) },
          transactions: { findMany: findManyMock },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      };

      const caller = createTestCaller(ctx);
      await caller.transaction.list({});

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 0 })
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm run test:unit -- src/server/routers/__tests__/transaction.test.ts
```

Expected: Tests fail (current implementation doesn't return { transactions, total, hasMore })

**Step 3: Update transaction router for pagination**

Read current `src/server/routers/transaction.ts`, then modify the `list` procedure.

The `list` procedure should be updated to:
```typescript
list: protectedProcedure
  .input(
    z.object({
      propertyId: z.string().uuid().optional(),
      category: z.nativeEnum(category).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const { limit, offset, propertyId, category: cat, startDate, endDate } = input;

    // Build where conditions
    const conditions = [eq(transactions.userId, ctx.user.id)];

    if (propertyId) {
      conditions.push(eq(transactions.propertyId, propertyId));
    }
    if (cat) {
      conditions.push(eq(transactions.category, cat));
    }
    if (startDate) {
      conditions.push(gte(transactions.date, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(transactions.date, new Date(endDate)));
    }

    const whereClause = and(...conditions);

    // Get paginated transactions
    const txns = await ctx.db.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit,
      offset,
      with: {
        property: true,
        bankAccount: true,
      },
    });

    // Get total count
    const [{ count: total }] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(whereClause);

    return {
      transactions: txns,
      total,
      hasMore: offset + txns.length < total,
    };
  }),
```

**Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:unit -- src/server/routers/__tests__/transaction.test.ts
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add src/server/routers/transaction.ts src/server/routers/__tests__/transaction.test.ts
git commit -m "feat: add server-side pagination to transaction list"
```

---

## Task 6: Update Transaction List UI for Pagination

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Create: `src/components/ui/pagination.tsx`

**Step 1: Create pagination component**

Create file `src/components/ui/pagination.tsx`:
```typescript
"use client";

import { Button } from "./button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
}: PaginationProps) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious || isLoading}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext || isLoading}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Update transactions page to use pagination**

Read current `src/app/(dashboard)/transactions/page.tsx`, then update to use pagination state and the new API response format.

Key changes:
1. Add `page` state starting at 1
2. Calculate `offset = (page - 1) * 50`
3. Pass `limit: 50, offset` to the query
4. Use `data.total` and `data.hasMore` from response
5. Add Pagination component at bottom

**Step 3: Test manually**

Run:
```bash
npm run dev
```

Navigate to /transactions, verify pagination controls appear and work.

**Step 4: Commit**

```bash
git add src/components/ui/pagination.tsx src/app/(dashboard)/transactions/page.tsx
git commit -m "feat: add pagination UI to transactions list"
```

---

## Task 7: Add Database Indexes for Performance

**Files:**
- Create: `drizzle/XXXX_add_performance_indexes.sql` (via drizzle-kit)
- Modify: `src/server/db/schema.ts`

**Step 1: Add indexes to schema**

Read current `src/server/db/schema.ts`, then add indexes to the transactions table.

Add after the transactions table definition:
```typescript
// Add indexes for common queries
export const transactionsUserIdIdx = index("transactions_user_id_idx").on(
  transactions.userId
);
export const transactionsPropertyIdIdx = index("transactions_property_id_idx").on(
  transactions.propertyId
);
export const transactionsDateIdx = index("transactions_date_idx").on(
  transactions.date
);
export const transactionsCategoryIdx = index("transactions_category_idx").on(
  transactions.category
);
export const transactionsUserDateIdx = index("transactions_user_date_idx").on(
  transactions.userId,
  transactions.date
);
```

**Step 2: Generate migration**

Run:
```bash
npm run db:generate
```

Expected: New migration file created in drizzle/ directory

**Step 3: Apply migration to database**

Run:
```bash
npm run db:push
```

Expected: Indexes created in database

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "perf: add database indexes for transaction queries"
```

---

## Task 8: Add Vercel Configuration

**Files:**
- Create: `vercel.json`

**Step 1: Create Vercel configuration**

Create file `vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["syd1"],
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://propertytracker.vercel.app"
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, must-revalidate"
        }
      ]
    }
  ],
  "crons": [
    {
      "path": "/api/cron/sync-banks",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Step 2: Create placeholder cron endpoint**

Create file `src/app/api/cron/sync-banks/route.ts`:
```typescript
import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Implement bank sync logic
  // This will be implemented when we build recurring transactions

  return NextResponse.json({
    success: true,
    message: "Bank sync cron executed",
    timestamp: new Date().toISOString(),
  });
}
```

**Step 3: Add CRON_SECRET to environment variables**

Add to `.env.local.example`:
```
# Vercel Cron
CRON_SECRET=your-random-secret-here
```

**Step 4: Commit**

```bash
git add vercel.json src/app/api/cron/ .env.local.example
git commit -m "feat: add Vercel configuration with cron job placeholder"
```

---

## Task 9: Update GitHub Actions for Vercel Preview Deployments

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Update CI workflow to wait for Vercel preview**

Add to `.github/workflows/ci.yml` after the e2e-tests job:

```yaml
  # Add comment with deployment status
  deployment-status:
    name: Deployment Status
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.event_name == 'pull_request'

    steps:
      - name: Comment PR with deployment link
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ All checks passed! Preview deployment is available on Vercel.'
            })
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add deployment status comment on PR"
```

---

## Task 10: Create Infrastructure Documentation

**Files:**
- Create: `docs/infrastructure.md`

**Step 1: Write infrastructure documentation**

Create file `docs/infrastructure.md`:
```markdown
# Infrastructure Documentation

## Overview

PropertyTracker uses the following infrastructure:

- **Hosting:** Vercel (Next.js optimized)
- **Database:** PostgreSQL on Supabase
- **Authentication:** Clerk
- **Error Tracking:** Sentry
- **CI/CD:** GitHub Actions + Vercel

## CI/CD Pipeline

### GitHub Actions

On every PR and push to main:

1. **Lint & Type Check** - ESLint and TypeScript
2. **Unit Tests** - Vitest
3. **Build** - Next.js production build
4. **E2E Tests** - Playwright (on main and ready PRs)

### Vercel Deployments

- **Production:** Automatic on merge to `main`
- **Preview:** Automatic on PR creation
- **Region:** Sydney (syd1) for Australian users

## Environment Variables

### Required for All Environments

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN |

### Production Only

| Variable | Description |
|----------|-------------|
| `SENTRY_AUTH_TOKEN` | For source map uploads |
| `CRON_SECRET` | Vercel cron authentication |

### E2E Testing

| Variable | Description |
|----------|-------------|
| `E2E_CLERK_USER_EMAIL` | Test user email |
| `E2E_CLERK_USER_PASSWORD` | Test user password |

## Monitoring

### Sentry

- **Errors:** Automatic capture with stack traces
- **Performance:** 10% sampling rate
- **Session Replay:** 10% normal, 100% on error

### Business Metrics (Future)

- Failed bank syncs
- Categorization accuracy
- Uncategorized transaction age

## Database

### Indexes

Optimized indexes on `transactions` table:
- `user_id` - User filtering
- `property_id` - Property filtering
- `date` - Date range queries
- `category` - Category filtering
- `(user_id, date)` - Combined user + date queries

## Cron Jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/sync-banks` | Daily 6am AEST | Bank transaction sync |

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```
```

**Step 2: Commit**

```bash
git add docs/infrastructure.md
git commit -m "docs: add infrastructure documentation"
```

---

## Summary

This plan implements:

1. **Unit Testing Framework** - Vitest with CSV import and tRPC permission tests
2. **CI/CD Pipeline** - GitHub Actions with lint, type-check, unit tests, build, E2E
3. **Error Monitoring** - Sentry with source maps and session replay
4. **Performance** - Server-side pagination and database indexes
5. **Deployment** - Vercel configuration with cron jobs
6. **Documentation** - Infrastructure overview

After completing these tasks, run full verification:

```bash
npm run lint && npx tsc --noEmit && npm run test:all && npm run build
```

All checks should pass before merging.
