# Monitoring & Alerting Design

**Date:** 2026-01-24
**Status:** Approved
**Scope:** Vercel Analytics, custom business metrics in Sentry, uptime monitoring

## Overview

Enhance existing Sentry error tracking with:
1. Vercel Analytics for Core Web Vitals
2. Custom business metrics (bank sync, categorization)
3. Health check endpoint for uptime monitoring

---

## Current State

Sentry is already configured with:
- Client, server, and edge configs
- Source maps upload
- Session replay for error context
- Performance tracing (10% sample rate)
- Console error capture

---

## Design

### 1. Vercel Analytics

Add Core Web Vitals tracking with zero configuration.

**Installation:**
```bash
npm install @vercel/analytics
```

**Integration in `src/app/layout.tsx`:**
```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

**Metrics tracked:**
- Page views and unique visitors
- Core Web Vitals (LCP, FID, CLS, TTFB)
- Top pages and referrers
- Device/browser breakdown

**Cost:** Free tier includes 2,500 events/month.

---

### 2. Custom Business Metrics

Track business-critical events in Sentry.

**Metrics:**

| Metric | Trigger | Purpose |
|--------|---------|---------|
| `bank_sync_failed` | Basiq sync fails | Alert on integration issues |
| `bank_sync_success` | Sync completes | Track reliability rate |
| `categorization_override` | User changes auto-category | Measure accuracy |

**Utility (`src/lib/metrics.ts`):**

```typescript
import * as Sentry from "@sentry/nextjs";

export const metrics = {
  bankSyncFailed: (accountId: string, error: string) => {
    Sentry.captureMessage("Bank sync failed", {
      level: "warning",
      tags: { type: "bank_sync", status: "failed" },
      extra: { accountId, error },
    });
  },

  bankSyncSuccess: (accountId: string, transactionCount: number) => {
    Sentry.addBreadcrumb({
      category: "bank_sync",
      message: `Synced ${transactionCount} transactions`,
      data: { accountId, transactionCount },
    });
  },

  categorizationOverride: (fromCategory: string, toCategory: string) => {
    Sentry.captureMessage("Category override", {
      level: "info",
      tags: { type: "categorization", action: "override" },
      extra: { fromCategory, toCategory },
    });
  },
};
```

**Usage:**
- Call in banking router catch blocks
- Call in transaction router when category changes

**Sentry alerts:**
- Create alert for >5 `bank_sync_failed` events in 1 hour

---

### 3. Uptime Monitoring

External service pings health endpoint to detect outages.

**Health check endpoint (`src/app/api/health/route.ts`):**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: "Database connection failed" },
      { status: 503 }
    );
  }
}
```

**Uptime service setup (manual):**

| Service | Free Tier | Recommendation |
|---------|-----------|----------------|
| BetterUptime | 10 monitors, 3-min | Recommended |
| UptimeRobot | 50 monitors, 5-min | Alternative |

**Configuration:**
- Monitor URL: `https://propertytracker.com/api/health`
- Check interval: 3 minutes
- Alert via: Email

---

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `@vercel/analytics` |
| `src/app/layout.tsx` | Add Analytics component |
| `src/lib/metrics.ts` | Create business metrics utility |
| `src/app/api/health/route.ts` | Create health check endpoint |
| `src/server/routers/banking.ts` | Add sync metrics calls |
| `src/server/routers/transaction.ts` | Add categorization metrics |

---

## Manual Setup Required

1. Sign up for BetterUptime (free tier)
2. Create monitor for `/api/health` endpoint
3. Configure email alerts

---

## Success Criteria

- Vercel Analytics shows page views and Web Vitals
- Bank sync failures appear in Sentry with `type:bank_sync` tag
- Health endpoint returns 200 when healthy, 503 when database down
- Uptime service alerts on outages within 3 minutes
