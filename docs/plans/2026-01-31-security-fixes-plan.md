# Security Vulnerability Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 critical/high security vulnerabilities identified in the security review.

**Architecture:** Each fix is isolated and can be committed independently. We'll add authentication to the entity switch endpoint, remove insecure defaults, eliminate debug logging, add security headers, and standardize billing context.

**Tech Stack:** Next.js 16, tRPC, Clerk authentication, Drizzle ORM, TypeScript

---

## Task 1: Fix Entity Switch Endpoint - Add Authentication & Ownership Validation

**Files:**
- Modify: `src/app/api/entity/switch/route.ts:1-16`
- Create: `src/app/api/entity/switch/__tests__/route.test.ts`

**Context:** This endpoint currently allows ANY request to set the `active_entity_id` cookie to ANY value, enabling complete account takeover. We need to add Clerk authentication and validate the entityId belongs to the user.

**Step 1: Write the failing test**

Create `src/app/api/entity/switch/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
  })),
}));

// Mock database
vi.mock("@/server/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      portfolioMembers: { findFirst: vi.fn() },
    },
  },
}));

import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

describe("entity switch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "some-entity-id" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when entityId does not belong to user", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user-1",
      clerkId: "clerk_123",
    } as never);
    vi.mocked(db.query.portfolioMembers.findFirst).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "other-user-id" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("allows switching to own entity", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user-1",
      clerkId: "clerk_123",
    } as never);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "user-1" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("allows switching to portfolio where user is member", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as never);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user-1",
      clerkId: "clerk_123",
    } as never);
    vi.mocked(db.query.portfolioMembers.findFirst).mockResolvedValue({
      ownerId: "other-user",
      userId: "user-1",
      joinedAt: new Date(),
    } as never);

    const request = new NextRequest("http://localhost/api/entity/switch", {
      method: "POST",
      body: JSON.stringify({ entityId: "other-user" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/entity/switch/__tests__/route.test.ts`
Expected: FAIL (route doesn't have auth checks)

**Step 3: Implement the fix**

Replace `src/app/api/entity/switch/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, portfolioMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  // Require authentication
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user from database
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const { entityId } = await request.json();

  // Validate entityId - must be user's own ID or a portfolio they have access to
  if (entityId !== user.id) {
    // Check if user is a member of this portfolio
    const membership = await db.query.portfolioMembers.findFirst({
      where: and(
        eq(portfolioMembers.ownerId, entityId),
        eq(portfolioMembers.userId, user.id)
      ),
    });

    if (!membership || !membership.joinedAt) {
      return NextResponse.json(
        { error: "You do not have access to this portfolio" },
        { status: 403 }
      );
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("active_entity_id", entityId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return NextResponse.json({ success: true });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/entity/switch/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/entity/switch/route.ts src/app/api/entity/switch/__tests__/route.test.ts
git commit -m "fix(security): add auth and ownership validation to entity switch endpoint

CRITICAL: Previously allowed unauthenticated requests to set any entityId,
enabling complete account takeover. Now requires Clerk auth and validates
the entityId belongs to the user or a portfolio they have access to."
```

---

## Task 2: Remove Weak JWT Secret Default

**Files:**
- Modify: `src/server/lib/mobile-jwt.ts:3`

**Context:** The JWT secret falls back to "development-secret-change-me" which could be deployed to production if the environment variable is missing.

**Step 1: Write the failing test**

The existing code will fail at runtime if JWT_SECRET is not set. We'll verify this behavior:

Create `src/server/lib/__tests__/mobile-jwt.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("mobile-jwt", () => {
  const originalEnv = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalEnv) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
    vi.resetModules();
  });

  it("throws error when JWT_SECRET is not set", async () => {
    delete process.env.JWT_SECRET;

    await expect(async () => {
      await import("../mobile-jwt");
    }).rejects.toThrow("JWT_SECRET environment variable is required");
  });

  it("exports JWT_SECRET when set", async () => {
    process.env.JWT_SECRET = "test-secret-123";

    const { JWT_SECRET } = await import("../mobile-jwt");
    expect(JWT_SECRET).toBe("test-secret-123");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/server/lib/__tests__/mobile-jwt.test.ts`
Expected: FAIL (currently doesn't throw)

**Step 3: Implement the fix**

Replace `src/server/lib/mobile-jwt.ts`:

```typescript
import { sign, verify } from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = "30d";

export interface MobileJwtPayload {
  userId: string;
  email: string;
}

export function verifyMobileToken(token: string): MobileJwtPayload {
  return verify(token, JWT_SECRET) as MobileJwtPayload;
}

export function signMobileToken(payload: MobileJwtPayload): string {
  return sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/server/lib/__tests__/mobile-jwt.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/lib/mobile-jwt.ts src/server/lib/__tests__/mobile-jwt.test.ts
git commit -m "fix(security): remove weak JWT secret default

CRITICAL: Previously fell back to 'development-secret-change-me' if
JWT_SECRET env var was missing. Now throws error at startup if not set,
preventing insecure deployment."
```

---

## Task 3: Remove Email Logging from Mobile Auth

**Files:**
- Modify: `src/server/routers/mobileAuth.ts:27-29`

**Context:** Email addresses are being logged during login attempts, exposing PII in server logs.

**Step 1: Verify the console.log statements exist**

The lines to remove are:
```typescript
console.log("[mobileAuth] Login attempt:", input.email.toLowerCase().trim());
console.log("[mobileAuth] User found:", !!user);
console.log("[mobileAuth] Has password:", !!user?.mobilePasswordHash);
```

**Step 2: Remove the logging statements**

Update `src/server/routers/mobileAuth.ts` to remove lines 27-29. The login mutation should look like:

```typescript
login: publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase().trim()),
    });

    if (!user || !user.mobilePasswordHash) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    const validPassword = await bcrypt.compare(
      input.password,
      user.mobilePasswordHash
    );
    // ... rest of function
```

**Step 3: Run existing tests**

Run: `npm test -- src/server/routers/__tests__/mobileAuth.test.ts` (if exists) or `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/routers/mobileAuth.ts
git commit -m "fix(security): remove email logging from mobile auth

CRITICAL: Email addresses were being logged during login attempts,
exposing PII in server logs. Removed all console.log statements
from authentication path."
```

---

## Task 4: Add Security Headers (CSP + HSTS)

**Files:**
- Modify: `next.config.ts:12-36`

**Context:** Missing Content-Security-Policy and Strict-Transport-Security headers provide defense-in-depth against XSS and protocol downgrade attacks.

**Step 1: Update next.config.ts headers**

Replace the headers function in `next.config.ts`:

```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.posthog.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https: http:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.posthog.com https://*.clerk.accounts.dev https://*.clerk.dev wss://*.clerk.accounts.dev https://api.basiq.io https://sentry.io https://*.ingest.sentry.io",
            "frame-src 'self' https://js.stripe.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
            "worker-src 'self' blob:",
          ].join("; "),
        },
      ],
    },
  ];
},
```

**Step 2: Test locally**

Run: `npm run dev`
Open browser DevTools > Network > check response headers for CSP and HSTS

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add CSP and HSTS security headers

- Added Strict-Transport-Security header (1 year, includeSubDomains)
- Added Content-Security-Policy header with allowlist for:
  - Stripe (payments)
  - PostHog (analytics)
  - Clerk (auth)
  - Supabase (database/storage)
  - Sentry (error tracking)"
```

---

## Task 5: Fix Billing Router Context Inconsistency

**Files:**
- Modify: `src/server/routers/billing.ts:59,82`

**Context:** The billing router uses `ctx.user.id` in some places and `ctx.portfolio.ownerId` in others. For billing operations (creating checkout/portal sessions), we should use `ctx.user.id` consistently since subscriptions belong to users, not portfolios.

**Step 1: Analyze the current behavior**

- `getSubscription` uses `ctx.portfolio.ownerId` (line 12) - This is correct for showing the subscription status of the portfolio being viewed
- `createCheckoutSession` uses `ctx.user.id` (line 59) - Correct, user creates their own subscription
- `createPortalSession` uses `ctx.user.id` (line 82) - Correct, user manages their own billing

The logic is actually correct! Users can only create/manage their own subscriptions, but can view the subscription status of portfolios they have access to.

**Step 2: Add a comment for clarity**

Update `src/server/routers/billing.ts` to add clarifying comments:

```typescript
export const billingRouter = router({
  // Shows subscription status of the portfolio being viewed
  // (could be user's own or a portfolio they have access to)
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const sub = await ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.portfolio.ownerId),
    });
    // ... rest unchanged

  // Creates checkout session for the CURRENT USER (not portfolio owner)
  // Users can only create/upgrade their own subscriptions
  createCheckoutSession: protectedProcedure
    .input(/* ... */)
    .mutation(async ({ ctx, input }) => {
      // ... existing code unchanged

  // Creates portal session for the CURRENT USER (not portfolio owner)
  // Users can only manage their own billing
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    // ... existing code unchanged
```

**Step 3: Commit**

```bash
git add src/server/routers/billing.ts
git commit -m "docs(billing): clarify userId context in billing router

Added comments explaining that getSubscription shows portfolio owner's
subscription (for viewing shared portfolios), while create* operations
use ctx.user.id (users can only manage their own billing)."
```

---

## Task 6: Fix SQL Injection in Similar Properties Router

**Files:**
- Modify: `src/server/routers/similarProperties.ts:123-151`

**Context:** The vector similarity search uses raw SQL with string interpolation for the vector. While the vector data comes from our own database, we should use proper parameterization.

**Step 1: Analyze the current code**

```typescript
const vectorStr = `[${propertyVector.vector.join(",")}]`;
// This is used in: ORDER BY pv.vector <-> ${vectorStr}::vector
```

The `vectorStr` is created from `propertyVector.vector` which is fetched from our database, so it's not directly user-controlled. However, the `input.includeCommunity` boolean is passed directly to SQL.

**Step 2: Fix the SQL query**

Update `src/server/routers/similarProperties.ts` around line 123:

```typescript
// The vector comes from our database, but we still parameterize properly
// Note: PostgreSQL pgvector requires the vector as a string literal
const vectorArray = propertyVector.vector;
if (!Array.isArray(vectorArray) || !vectorArray.every(n => typeof n === 'number')) {
  throw new Error("Invalid vector data");
}
const vectorStr = `[${vectorArray.join(",")}]`;

// Build WHERE clause with proper parameterization
// Note: For the boolean, we use a conditional query structure instead of interpolating
const results = input.includeCommunity
  ? await ctx.db.execute(sql`
      SELECT
        pv.id,
        pv.property_id,
        pv.external_listing_id,
        pv.user_id,
        pv.vector <-> ${vectorStr}::vector AS distance,
        p.suburb as property_suburb,
        p.state as property_state,
        p.address as property_address,
        el.suburb as listing_suburb,
        el.state as listing_state,
        el.property_type as listing_type,
        el.price as listing_price,
        el.source_url as listing_url
      FROM property_vectors pv
      LEFT JOIN properties p ON p.id = pv.property_id
      LEFT JOIN external_listings el ON el.id = pv.external_listing_id
      WHERE pv.id != ${propertyVector.id}
        AND (pv.user_id = ${ctx.portfolio.ownerId} OR pv.is_shared = true)
      ORDER BY pv.vector <-> ${vectorStr}::vector
      LIMIT ${input.limit}
    `)
  : await ctx.db.execute(sql`
      SELECT
        pv.id,
        pv.property_id,
        pv.external_listing_id,
        pv.user_id,
        pv.vector <-> ${vectorStr}::vector AS distance,
        p.suburb as property_suburb,
        p.state as property_state,
        p.address as property_address,
        el.suburb as listing_suburb,
        el.state as listing_state,
        el.property_type as listing_type,
        el.price as listing_price,
        el.source_url as listing_url
      FROM property_vectors pv
      LEFT JOIN properties p ON p.id = pv.property_id
      LEFT JOIN external_listings el ON el.id = pv.external_listing_id
      WHERE pv.id != ${propertyVector.id}
        AND pv.user_id = ${ctx.portfolio.ownerId}
      ORDER BY pv.vector <-> ${vectorStr}::vector
      LIMIT ${input.limit}
    `);
```

**Step 3: Run existing tests**

Run: `npm test -- src/server/routers/__tests__/similarProperties.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/routers/similarProperties.ts
git commit -m "fix(security): improve SQL safety in similar properties router

- Added validation for vector array data type
- Replaced boolean interpolation with conditional query structure
- Vector string still uses interpolation due to pgvector requirements,
  but vector data comes from our own database (not user input)"
```

---

## Task 7: Add File Type Magic Number Validation

**Files:**
- Create: `src/lib/file-validation.ts`
- Modify: `src/server/routers/documents.ts`

**Context:** File uploads only check MIME type from the client, which can be spoofed. We should validate the file's magic bytes on the server.

**Step 1: Create file validation utility**

Create `src/lib/file-validation.ts`:

```typescript
// Magic bytes for common file types
const MAGIC_BYTES: Record<string, number[][]> = {
  // PDF: %PDF
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
  // JPEG: FFD8FF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  // PNG: 89504E47
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  // HEIC: various ftyp boxes
  "image/heic": [
    [0x00, 0x00, 0x00], // ftyp box (variable length prefix)
  ],
};

/**
 * Validate file content matches expected MIME type using magic bytes
 */
export function validateFileType(
  buffer: ArrayBuffer,
  expectedMimeType: string
): boolean {
  const bytes = new Uint8Array(buffer);
  const signatures = MAGIC_BYTES[expectedMimeType];

  if (!signatures) {
    // Unknown type - allow but log warning
    console.warn(`No magic bytes defined for ${expectedMimeType}`);
    return true;
  }

  // Check if any signature matches
  return signatures.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/**
 * Detect file type from magic bytes
 */
export function detectFileType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);

  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    const matches = signatures.some((signature) =>
      signature.every((byte, index) => bytes[index] === byte)
    );
    if (matches) {
      return mimeType;
    }
  }

  return null;
}
```

**Step 2: Add tests for file validation**

Create `src/lib/__tests__/file-validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateFileType, detectFileType } from "../file-validation";

describe("file-validation", () => {
  it("validates PDF magic bytes", () => {
    // %PDF-1.4
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(validateFileType(pdfBytes.buffer, "application/pdf")).toBe(true);
  });

  it("rejects invalid PDF", () => {
    const notPdf = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(validateFileType(notPdf.buffer, "application/pdf")).toBe(false);
  });

  it("validates JPEG magic bytes", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateFileType(jpegBytes.buffer, "image/jpeg")).toBe(true);
  });

  it("validates PNG magic bytes", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateFileType(pngBytes.buffer, "image/png")).toBe(true);
  });

  it("detects file type from bytes", () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(detectFileType(pdfBytes.buffer)).toBe("application/pdf");
  });

  it("returns null for unknown file type", () => {
    const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(detectFileType(unknownBytes.buffer)).toBe(null);
  });
});
```

**Step 3: Run tests**

Run: `npm test -- src/lib/__tests__/file-validation.test.ts`
Expected: PASS

**Step 4: Update documents router to use validation (optional - for server-side processing)**

Note: Since file uploads go directly to Supabase from the client, server-side validation would require changing the upload flow. For now, we've added the utility for future use.

**Step 5: Commit**

```bash
git add src/lib/file-validation.ts src/lib/__tests__/file-validation.test.ts
git commit -m "feat(security): add file type magic byte validation utility

Added utility functions for validating file types using magic bytes:
- validateFileType(): Verify file content matches expected MIME type
- detectFileType(): Detect file type from content

Supports PDF, JPEG, PNG, HEIC. Can be used for server-side
validation when processing uploaded files."
```

---

## Summary

| Task | Severity | Status |
|------|----------|--------|
| 1. Entity Switch Auth | CRITICAL | Ready to implement |
| 2. JWT Secret Default | CRITICAL | Ready to implement |
| 3. Email Logging | CRITICAL | Ready to implement |
| 4. Security Headers | HIGH | Ready to implement |
| 5. Billing Context | MEDIUM | Clarification only (code was correct) |
| 6. SQL Injection | CRITICAL | Ready to implement |
| 7. File Validation | HIGH | Utility added |

**Estimated Total Effort:** 2-3 hours

**Testing Commands:**
```bash
# Run all tests
npm test

# Run specific test files
npm test -- src/app/api/entity/switch/__tests__/route.test.ts
npm test -- src/server/lib/__tests__/mobile-jwt.test.ts
npm test -- src/lib/__tests__/file-validation.test.ts

# Run lint
npm run lint

# Run build
npm run build
```
