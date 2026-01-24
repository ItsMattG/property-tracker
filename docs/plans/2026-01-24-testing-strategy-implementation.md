# Testing Strategy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add auth/permission tests to high-risk routers and E2E cross-tenant access test.

**Architecture:** Extend existing test-utils with auth test helpers. Add auth tests to transaction, banking, documents routers. Create E2E test that seeds decoy user data and verifies isolation.

**Tech Stack:** Vitest, Playwright, Drizzle ORM, existing test fixtures

---

## Task 1: Extend Test Utils with Auth Helpers

**Files:**
- Modify: `src/server/__tests__/test-utils.ts`

**Step 1: Add auth test helper constants and types**

Add to `src/server/__tests__/test-utils.ts`:

```typescript
import { TRPCError } from "@trpc/server";
import { vi } from "vitest";

// Standard mock user for tests
export const mockUser = {
  id: "user-1",
  clerkId: "clerk_123",
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Different user for isolation tests
export const otherUser = {
  id: "user-2",
  clerkId: "clerk_456",
  email: "other@example.com",
  name: "Other User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Create context with user lookup mock
export function createAuthenticatedContext(user = mockUser) {
  const ctx = createMockContext({ clerkId: user.clerkId, user });
  ctx.db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(user),
      },
    },
  };
  return ctx;
}

// Create unauthenticated context
export function createUnauthenticatedContext() {
  return createMockContext({ clerkId: null });
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run existing tests**

Run: `npx vitest run src/server`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/__tests__/test-utils.ts
git commit -m "feat: add auth test helpers to test-utils

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Auth Tests to Transaction Router

**Files:**
- Modify: `src/server/routers/__tests__/transaction.test.ts`

**Step 1: Add auth and isolation tests**

Add to `src/server/routers/__tests__/transaction.test.ts`:

```typescript
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  mockUser,
  createUnauthenticatedContext,
  createAuthenticatedContext,
} from "../../__tests__/test-utils";

describe("transaction router", () => {
  describe("authentication", () => {
    it("throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.transaction.list({})).rejects.toThrow(TRPCError);
      await expect(caller.transaction.list({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws UNAUTHORIZED when user not found in database", async () => {
      const ctx = createMockContext({ clerkId: "clerk_123" });
      ctx.db = {
        query: {
          users: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };
      const caller = createTestCaller(ctx);

      await expect(caller.transaction.list({})).rejects.toThrow(TRPCError);
      await expect(caller.transaction.list({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("data isolation", () => {
    it("transaction.list only returns user's transactions", async () => {
      const ctx = createAuthenticatedContext();
      const findManyMock = vi.fn().mockResolvedValue([]);

      ctx.db.query.transactions = { findMany: findManyMock };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const caller = createTestCaller(ctx);
      await caller.transaction.list({});

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("transaction.update only updates user's own transactions", async () => {
      const ctx = createAuthenticatedContext();
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      ctx.db.update = updateMock;

      const caller = createTestCaller(ctx);
      const result = await caller.transaction.update({
        id: "550e8400-e29b-41d4-a716-446655440000",
        category: "insurance",
      });

      expect(updateMock).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("transaction.delete only deletes user's own transactions", async () => {
      const ctx = createAuthenticatedContext();
      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      ctx.db.delete = deleteMock;

      const caller = createTestCaller(ctx);
      await caller.transaction.delete({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(deleteMock).toHaveBeenCalled();
    });

    it("transaction.create associates transaction with authenticated user", async () => {
      const ctx = createAuthenticatedContext();
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new-tx", userId: mockUser.id }]),
        }),
      });

      ctx.db.insert = insertMock;

      const caller = createTestCaller(ctx);
      await caller.transaction.create({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2025-01-01",
        description: "Test",
        amount: "100",
      });

      expect(insertMock).toHaveBeenCalled();
    });
  });

  // ... existing pagination tests ...
});
```

**Step 2: Run tests**

Run: `npx vitest run src/server/routers/__tests__/transaction.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/transaction.test.ts
git commit -m "test: add auth/isolation tests to transaction router

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Auth Tests to Banking Router

**Files:**
- Create: `src/server/routers/__tests__/banking.test.ts`

**Step 1: Create banking auth tests**

Create `src/server/routers/__tests__/banking.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createMockContext,
  createTestCaller,
  mockUser,
  createUnauthenticatedContext,
  createAuthenticatedContext,
} from "../../__tests__/test-utils";

describe("banking router", () => {
  describe("authentication", () => {
    it("listAccounts throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.banking.listAccounts()).rejects.toThrow(TRPCError);
      await expect(caller.banking.listAccounts()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("listAlerts throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(caller.banking.listAlerts()).rejects.toThrow(TRPCError);
    });
  });

  describe("data isolation", () => {
    it("listAccounts only returns user's accounts", async () => {
      const ctx = createAuthenticatedContext();
      const findManyMock = vi.fn().mockResolvedValue([]);

      ctx.db.query.bankAccounts = { findMany: findManyMock };

      const caller = createTestCaller(ctx);
      await caller.banking.listAccounts();

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("syncAccount rejects non-owned account", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.bankAccounts = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.banking.syncAccount({
          accountId: "other-user-account",
        })
      ).rejects.toThrow("Account not found");
    });

    it("dismissAlert rejects non-owned alert", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.connectionAlerts = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.banking.dismissAlert({
          alertId: "other-user-alert",
        })
      ).rejects.toThrow();
    });

    it("listAlerts only returns user's alerts", async () => {
      const ctx = createAuthenticatedContext();
      const findManyMock = vi.fn().mockResolvedValue([]);

      ctx.db.query.connectionAlerts = { findMany: findManyMock };

      const caller = createTestCaller(ctx);
      await caller.banking.listAlerts();

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });

    it("reconnect rejects non-owned account", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.bankAccounts = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.banking.reconnect({
          accountId: "other-user-account",
        })
      ).rejects.toThrow("Account not found");
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/server/routers/__tests__/banking.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/banking.test.ts
git commit -m "test: add auth/isolation tests to banking router

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Auth Tests to Documents Router

**Files:**
- Modify: `src/server/routers/__tests__/documents.test.ts`

**Step 1: Add auth tests to existing file**

Add to `src/server/routers/__tests__/documents.test.ts` after imports:

```typescript
import { TRPCError } from "@trpc/server";
import {
  createUnauthenticatedContext,
  createAuthenticatedContext,
} from "../../__tests__/test-utils";

describe("documents router", () => {
  describe("authentication", () => {
    it("getUploadUrl throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.getUploadUrl({
          fileName: "test.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.documents.getUploadUrl({
          fileName: "test.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("list throws UNAUTHORIZED when not authenticated", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.list({
          propertyId: "550e8400-e29b-41d4-a716-446655440000",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("data isolation", () => {
    it("getUploadUrl rejects other user's property", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.properties = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.getUploadUrl({
          fileName: "test.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          propertyId: "other-user-property",
        })
      ).rejects.toThrow("Property not found");
    });

    it("delete rejects other user's document", async () => {
      const ctx = createAuthenticatedContext();
      ctx.db.query.documents = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const caller = createTestCaller(ctx);

      await expect(
        caller.documents.delete({
          id: "other-user-document",
        })
      ).rejects.toThrow("Document not found");
    });

    it("list only returns user's documents", async () => {
      const ctx = createAuthenticatedContext();
      const findManyMock = vi.fn().mockResolvedValue([]);

      ctx.db.query.documents = { findMany: findManyMock };

      const mockFrom = vi.mocked(supabaseAdmin.storage.from);
      mockFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com" },
          error: null,
        }),
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>);

      const caller = createTestCaller(ctx);
      await caller.documents.list({
        propertyId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });
  });

  // ... existing tests ...
});
```

**Step 2: Run tests**

Run: `npx vitest run src/server/routers/__tests__/documents.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/routers/__tests__/documents.test.ts
git commit -m "test: add auth/isolation tests to documents router

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create E2E Cross-Tenant Seed Helper

**Files:**
- Create: `e2e/fixtures/decoy-data.ts`

**Step 1: Create decoy data seeding helper**

Create `e2e/fixtures/decoy-data.ts`:

```typescript
import { testDb, schema } from "./db";
import { randomUUID } from "crypto";

// Decoy user that should never be accessible by the test user
let decoyUserId: string | null = null;
let decoyPropertyId: string | null = null;
let decoyTransactionId: string | null = null;

export function getDecoyIds() {
  if (!decoyUserId || !decoyPropertyId) {
    throw new Error("Decoy data not seeded. Call seedDecoyData() first.");
  }
  return {
    userId: decoyUserId,
    propertyId: decoyPropertyId,
    transactionId: decoyTransactionId,
  };
}

/**
 * Seed a complete decoy user scenario.
 * This data should NEVER be accessible by the real test user.
 */
export async function seedDecoyData() {
  // Create decoy user
  decoyUserId = randomUUID();
  await testDb.insert(schema.users).values({
    id: decoyUserId,
    clerkId: `decoy_clerk_${Date.now()}`,
    email: `decoy-${Date.now()}@test.com`,
    name: "Decoy User",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create decoy property
  decoyPropertyId = randomUUID();
  await testDb.insert(schema.properties).values({
    id: decoyPropertyId,
    userId: decoyUserId,
    address: "999 Decoy Street",
    suburb: "Decoyville",
    state: "NSW",
    postcode: "9999",
    purchasePrice: "999999.00",
    purchaseDate: "2020-01-01",
    entityName: "Decoy Entity",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create decoy transaction (no bank account needed for manual tx)
  decoyTransactionId = randomUUID();
  await testDb.insert(schema.transactions).values({
    id: decoyTransactionId,
    userId: decoyUserId,
    propertyId: decoyPropertyId,
    description: "Decoy Transaction - SHOULD NOT BE VISIBLE",
    amount: "-99999.00",
    date: "2020-01-01",
    category: "uncategorized",
    transactionType: "expense",
    isDeductible: false,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return getDecoyIds();
}

/**
 * Clean up decoy data after tests.
 */
export async function cleanupDecoyData() {
  if (decoyUserId) {
    const { eq } = await import("drizzle-orm");

    await testDb.delete(schema.transactions).where(eq(schema.transactions.userId, decoyUserId));
    await testDb.delete(schema.properties).where(eq(schema.properties.userId, decoyUserId));
    await testDb.delete(schema.users).where(eq(schema.users.id, decoyUserId));

    decoyUserId = null;
    decoyPropertyId = null;
    decoyTransactionId = null;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add e2e/fixtures/decoy-data.ts
git commit -m "test: add decoy data seeding helper for cross-tenant E2E tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create E2E Cross-Tenant Access Test

**Files:**
- Create: `e2e/cross-tenant-access.spec.ts`

**Step 1: Create cross-tenant access test**

Create `e2e/cross-tenant-access.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { seedDecoyData, cleanupDecoyData, getDecoyIds } from "./fixtures/decoy-data";
import { closeDbConnection } from "./fixtures/db";

test.describe("Cross-Tenant Access Protection", () => {
  let decoyIds: { userId: string; propertyId: string; transactionId: string | null };

  test.beforeAll(async () => {
    decoyIds = await seedDecoyData();
  });

  test.afterAll(async () => {
    await cleanupDecoyData();
    await closeDbConnection();
  });

  test("cannot access another user's property via direct URL", async ({ page }) => {
    // Navigate to decoy property
    await page.goto(`/properties/${decoyIds.propertyId}`);

    // Should show error or redirect, not the property details
    // Check for "not found" message or redirect to properties list
    const content = await page.content();
    const notFoundOrRedirect =
      content.includes("not found") ||
      content.includes("Property not found") ||
      page.url().includes("/properties") && !page.url().includes(decoyIds.propertyId);

    expect(notFoundOrRedirect).toBe(true);
  });

  test("cannot see another user's transactions", async ({ page }) => {
    // Navigate to transactions with decoy property filter
    await page.goto(`/transactions?propertyId=${decoyIds.propertyId}`);

    // Should show empty list or no results
    // The decoy transaction description should NOT appear
    const content = await page.content();
    expect(content).not.toContain("Decoy Transaction");
    expect(content).not.toContain("SHOULD NOT BE VISIBLE");
  });

  test("cannot edit another user's property", async ({ page }) => {
    // Try to access edit page for decoy property
    await page.goto(`/properties/${decoyIds.propertyId}/edit`);

    // Should show error or redirect
    const content = await page.content();
    const notFoundOrRedirect =
      content.includes("not found") ||
      content.includes("Property not found") ||
      !page.url().includes(decoyIds.propertyId);

    expect(notFoundOrRedirect).toBe(true);
  });

  test("API rejects access to another user's property", async ({ page, request }) => {
    // First visit the app to get authenticated session
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Get cookies for API request
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Try to fetch decoy property via tRPC
    const response = await request.get(
      `/api/trpc/property.get?input=${encodeURIComponent(JSON.stringify({ id: decoyIds.propertyId }))}`,
      {
        headers: {
          Cookie: cookieHeader,
        },
      }
    );

    // Should return error, not the property
    const body = await response.json();
    expect(body.error || body.result?.error).toBeTruthy();
  });
});
```

**Step 2: Run E2E tests**

Run: `npx playwright test e2e/cross-tenant-access.spec.ts`
Expected: All tests pass (requires test user to be logged in via Clerk)

**Step 3: Commit**

```bash
git add e2e/cross-tenant-access.spec.ts
git commit -m "test: add E2E cross-tenant access protection tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Run Full Test Suite

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass (should be ~175+ tests now)

**Step 2: Run E2E tests**

Run: `npx playwright test`
Expected: All tests pass

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any test issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Step 4: Push to remote**

```bash
git push origin feature/infrastructure
```

---

## Summary

| Task | Tests Added | Purpose |
|------|-------------|---------|
| Task 1 | Helper functions | Reusable auth test patterns |
| Task 2 | ~6 tests | Transaction router auth/isolation |
| Task 3 | ~6 tests | Banking router auth/isolation |
| Task 4 | ~5 tests | Documents router auth/isolation |
| Task 5 | Helper functions | Decoy data seeding |
| Task 6 | 4 E2E tests | Cross-tenant access protection |
| Task 7 | Verification | Full suite runs green |

**Total new tests:** ~20 unit tests + 4 E2E tests
