# Preview Deployment Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tRPC error sanitization to hide raw database errors from frontend, keeping error IDs for debugging.

**Architecture:** Add `onError` handler to tRPC fetch handler that catches non-TRPCError exceptions, logs full details to Axiom, and replaces error message with sanitized version containing error ID.

**Tech Stack:** tRPC onError callback, Node crypto.randomUUID, existing logger module.

---

## Task 1: Add Error Sanitization to tRPC Route

**Files:**
- Modify: `src/app/api/trpc/[trpc]/route.ts`

**Step 1: Read the current file**

The current file is minimal:
```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });

export { handler as GET, handler as POST };
```

**Step 2: Add error sanitization with logging**

Replace the entire file with:

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError: ({ error, path }) => {
      // TRPCErrors are intentional application errors - pass through unchanged
      if (error.code !== "INTERNAL_SERVER_ERROR") {
        return;
      }

      // Database/unknown errors - generate ID, log full details, sanitize message
      const errorId = randomUUID().slice(0, 8);

      logger.error("Unhandled API error", {
        errorId,
        path,
        message: error.message,
        stack: error.stack,
        cause: error.cause instanceof Error ? {
          message: error.cause.message,
          stack: error.cause.stack,
        } : error.cause,
      });

      // Replace error message with sanitized version
      // The error object is mutable, so this affects what gets sent to client
      error.message = `Something went wrong (Error ID: ${errorId})`;
    },
  });

export { handler as GET, handler as POST };
```

**Step 3: Run type check to verify imports**

Run: `npx tsc --noEmit 2>&1 | grep -E "(route\.ts|error)" | head -20`

Expected: No errors related to this file

**Step 4: Run existing tests to ensure no regression**

Run: `npm test -- --testPathPattern="trpc|router" --passWithNoTests 2>&1 | tail -20`

Expected: All tests pass (or no tests match, which is fine)

**Step 5: Commit**

```bash
git add src/app/api/trpc/[trpc]/route.ts
git commit -m "fix: sanitize database errors in tRPC responses

- Add onError handler to tRPC fetch handler
- Generate 8-char error ID for each unhandled error
- Log full error details to Axiom with error ID
- Return sanitized message to client
- Pass through intentional TRPCErrors unchanged

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Manual Verification

**Step 1: Start local dev server**

Run: `npm run dev`

**Step 2: Test error sanitization**

Open browser dev tools Network tab, then trigger an error by:
1. Temporarily break a database query in a router
2. Or disconnect from database

Verify response shows: `"Something went wrong (Error ID: xxxxxxxx)"`

Verify server logs show full error with matching error ID.

**Step 3: Test TRPCErrors still work**

Verify intentional errors like "Property not found" (NOT_FOUND) still show their original messages.

---

## Task 3: Demo Account Setup (Manual)

**Step 1: Create Clerk user**

1. Go to Clerk Dashboard → Users → Create User
2. Email: `demo@propertytracker.com.au`
3. Set a password (store securely)
4. Note the User ID (format: `user_xxx`)

**Step 2: Seed demo data**

Run: `npm run seed:demo -- --clerk-id=user_xxx`

Replace `user_xxx` with the actual Clerk User ID from step 1.

Expected output:
```
Starting seed in demo mode for Clerk ID: user_xxx
User ID: <uuid>
Generating demo data (5-year realistic portfolio)...
Seed complete!

=== Seed Summary ===
Properties:    3
Bank Accounts: 6
Transactions:  ~1800
Loans:         3
Alerts:        5
Compliance:    9
====================
```

**Step 3: Test demo login**

1. Go to production/preview URL
2. Sign in with demo@propertytracker.com.au
3. Verify dashboard shows properties and data
4. Navigate through features to confirm data displays correctly

---

## Summary

| Task | Type | Status |
|------|------|--------|
| 1. Add tRPC error sanitization | Code | Pending |
| 2. Manual verification | Test | Pending |
| 3. Demo account setup | Manual | Pending |
