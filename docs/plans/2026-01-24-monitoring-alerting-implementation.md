# Monitoring & Alerting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Vercel Analytics, custom business metrics in Sentry, and a health check endpoint for uptime monitoring.

**Architecture:** Install Vercel Analytics in root layout, create metrics utility for Sentry custom events, add health endpoint that checks database connectivity.

**Tech Stack:** @vercel/analytics, @sentry/nextjs (existing), Next.js API routes, Drizzle ORM

---

## Task 1: Add Vercel Analytics

**Files:**
- Modify: `package.json`
- Modify: `src/app/layout.tsx`

**Step 1: Add @vercel/analytics to package.json**

Add to dependencies in `package.json`:

```json
"@vercel/analytics": "^1.4.1"
```

**Step 2: Update root layout**

Modify `src/app/layout.tsx` to add Analytics:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCProvider } from "@/lib/trpc/Provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PropertyTracker - Australian Property Investment Tracking",
  description: "Track your investment properties, automate bank feeds, and generate tax reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <TRPCProvider>{children}</TRPCProvider>
          <Toaster richColors position="top-right" />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Step 3: Commit**

```bash
git add package.json src/app/layout.tsx
git commit -m "feat: add Vercel Analytics for Core Web Vitals tracking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Business Metrics Utility

**Files:**
- Create: `src/lib/metrics.ts`

**Step 1: Create metrics utility**

Create `src/lib/metrics.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

/**
 * Business metrics tracking via Sentry.
 * These custom events help monitor application health beyond errors.
 */
export const metrics = {
  /**
   * Track a failed bank sync attempt.
   * Use in catch blocks when Basiq sync fails.
   */
  bankSyncFailed: (accountId: string, error: string) => {
    Sentry.captureMessage("Bank sync failed", {
      level: "warning",
      tags: {
        type: "bank_sync",
        status: "failed",
      },
      extra: {
        accountId,
        error,
      },
    });
  },

  /**
   * Track a successful bank sync.
   * Added as breadcrumb for context on future errors.
   */
  bankSyncSuccess: (accountId: string, transactionCount: number) => {
    Sentry.addBreadcrumb({
      category: "bank_sync",
      message: `Synced ${transactionCount} transactions`,
      level: "info",
      data: {
        accountId,
        transactionCount,
      },
    });
  },

  /**
   * Track when a user overrides an auto-categorized transaction.
   * Helps measure categorization accuracy.
   */
  categorizationOverride: (
    transactionId: string,
    fromCategory: string,
    toCategory: string
  ) => {
    Sentry.captureMessage("Category override", {
      level: "info",
      tags: {
        type: "categorization",
        action: "override",
      },
      extra: {
        transactionId,
        fromCategory,
        toCategory,
      },
    });
  },
};
```

**Step 2: Commit**

```bash
git add src/lib/metrics.ts
git commit -m "feat: add business metrics utility for Sentry tracking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Health Check Endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

**Step 1: Create health check endpoint**

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check endpoint for uptime monitoring.
 * Returns 200 if the application and database are healthy.
 * Returns 503 if the database connection fails.
 *
 * Configure your uptime monitor (BetterUptime, UptimeRobot, etc.)
 * to ping this endpoint every 3-5 minutes.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connectivity with a simple query
    await db.execute(sql`SELECT 1`);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: "ok",
      },
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: "failed",
        },
        responseTime: `${responseTime}ms`,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
```

**Step 2: Test locally**

Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"healthy","timestamp":"...","checks":{"database":"ok"},"responseTime":"..."}`

**Step 3: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add health check endpoint for uptime monitoring

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Integrate Metrics into Banking Router

**Files:**
- Modify: `src/server/routers/banking.ts`

**Step 1: Add metrics import and calls**

At the top of `src/server/routers/banking.ts`, add:

```typescript
import { metrics } from "@/lib/metrics";
```

**Step 2: Add metrics to syncAccount catch block**

Find the `syncAccount` mutation's catch block and add metrics tracking. Look for the try/catch that handles Basiq sync errors and add:

```typescript
// In the catch block after a sync failure:
metrics.bankSyncFailed(input.accountId, error instanceof Error ? error.message : "Unknown error");
```

**Step 3: Add metrics after successful sync**

After transactions are successfully synced, add:

```typescript
// After successful transaction insert:
metrics.bankSyncSuccess(input.accountId, newTransactions.length);
```

**Step 4: Commit**

```bash
git add src/server/routers/banking.ts
git commit -m "feat: add bank sync metrics tracking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Integrate Metrics into Transaction Router

**Files:**
- Modify: `src/server/routers/transaction.ts`

**Step 1: Add metrics import**

At the top of `src/server/routers/transaction.ts`, add:

```typescript
import { metrics } from "@/lib/metrics";
```

**Step 2: Track category overrides in updateCategory**

In the `updateCategory` mutation, before updating the transaction, fetch the current category and compare:

```typescript
// At the start of updateCategory mutation, after user validation:
const existingTx = await ctx.db.query.transactions.findFirst({
  where: and(
    eq(transactions.id, input.id),
    eq(transactions.userId, ctx.user.id)
  ),
  columns: { category: true },
});

// After the update completes, track if category changed:
if (existingTx && existingTx.category !== input.category) {
  metrics.categorizationOverride(input.id, existingTx.category, input.category);
}
```

**Step 3: Commit**

```bash
git add src/server/routers/transaction.ts
git commit -m "feat: add categorization override metrics tracking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Push and Verify

**Step 1: Run tests to ensure no regressions**

Run: `npm run test:unit`
Expected: All tests pass

**Step 2: Push changes**

```bash
git push origin feature/infrastructure
```

**Step 3: Verify in Vercel**

After deployment, check:
- Vercel Analytics tab shows data
- `/api/health` endpoint returns 200

**Step 4: Manual setup reminder**

Print: "Remember to set up BetterUptime monitor for /api/health endpoint"

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | package.json, layout.tsx | Add Vercel Analytics |
| 2 | src/lib/metrics.ts | Create metrics utility |
| 3 | src/app/api/health/route.ts | Health check endpoint |
| 4 | src/server/routers/banking.ts | Bank sync metrics |
| 5 | src/server/routers/transaction.ts | Category override metrics |
| 6 | - | Push and verify |
