# Monitoring & Alerting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add self-contained uptime monitoring, cron health checks, and ntfy.sh alerting — no external SaaS dependencies.

**Architecture:** Enhanced `/api/health` endpoint with real DB check. Two new Vercel crons: uptime-check (every 5 min) and health-monitor (daily 7 AM). State tracked in two new DB tables. Alerts via ntfy.sh HTTP POST on state transitions only. Active crons write heartbeats after execution.

**Tech Stack:** Next.js API routes, Drizzle ORM (postgres-js), Vercel crons, ntfy.sh

---

### Task 1: Monitoring Schema

**Files:**
- Modify: `src/server/db/schema.ts` (append after `subscriptions` table at line ~3166)
- Create: `drizzle/0023_monitoring_tables.sql`

**Step 1: Add `cronHeartbeats` and `monitorState` tables to schema**

Append to the end of `src/server/db/schema.ts`:

```typescript
// ─── Monitoring ───────────────────────────────────────────────

export const cronHeartbeats = pgTable("cron_heartbeats", {
  id: uuid("id").primaryKey().defaultRandom(),
  cronName: text("cron_name").notNull().unique(),
  lastRunAt: timestamp("last_run_at").notNull(),
  status: text("status").notNull(), // "success" | "failure"
  durationMs: integer("duration_ms").notNull(),
  metadata: jsonb("metadata"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const monitorState = pgTable("monitor_state", {
  id: text("id").primaryKey(), // "uptime"
  lastStatus: text("last_status").notNull(), // "healthy" | "unhealthy"
  lastCheckedAt: timestamp("last_checked_at").notNull(),
  failingSince: timestamp("failing_since"),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
});
```

**Step 2: Generate the migration**

Run: `npx drizzle-kit generate`

Expected: New SQL migration file created in `drizzle/` directory. If drizzle-kit generates a file with a different name, rename it to `0023_monitoring_tables.sql` for clarity, or leave the auto-generated name.

**Step 3: Verify the migration SQL looks correct**

Read the generated migration file and confirm it has:
- `CREATE TABLE "cron_heartbeats"` with all columns
- `CREATE TABLE "monitor_state"` with all columns
- `UNIQUE` constraint on `cron_heartbeats.cron_name`

**Step 4: Push schema to dev database**

Run: `npx drizzle-kit push`

Expected: Tables created successfully. If `DATABASE_URL` is not set locally, skip this step — CI/deployment will handle it.

**Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(monitoring): add cron_heartbeats and monitor_state tables"
```

---

### Task 2: Monitoring Utility (`src/lib/monitoring.ts`)

**Files:**
- Create: `src/lib/__tests__/monitoring.test.ts`
- Create: `src/lib/monitoring.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/monitoring.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock the database
const mockExecute = vi.fn();
vi.mock("@/server/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          execute: mockExecute,
        })),
      })),
    })),
  },
}));

import { sendAlert, recordHeartbeat } from "../monitoring";

describe("monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    mockExecute.mockResolvedValue(undefined);
  });

  describe("sendAlert", () => {
    it("sends POST to ntfy with correct headers", async () => {
      await sendAlert("Test Title", "Test message");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ntfy.sh"),
        expect.objectContaining({
          method: "POST",
          body: "Test message",
          headers: expect.objectContaining({
            Title: "Test Title",
          }),
        })
      );
    });

    it("sends high priority when specified", async () => {
      await sendAlert("Alert", "Body", "high");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Priority: "high",
          }),
        })
      );
    });

    it("does not throw on fetch failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(sendAlert("Title", "Body")).resolves.not.toThrow();
    });
  });

  describe("recordHeartbeat", () => {
    it("calls db insert with correct cron name and status", async () => {
      const { db } = await import("@/server/db");

      await recordHeartbeat("sync-banks", {
        status: "success",
        durationMs: 1234,
        metadata: { processed: 5 },
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("does not throw on db failure", async () => {
      mockExecute.mockRejectedValue(new Error("DB error"));

      await expect(
        recordHeartbeat("sync-banks", {
          status: "failure",
          durationMs: 500,
        })
      ).resolves.not.toThrow();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/monitoring.test.ts`

Expected: FAIL — `Cannot find module '../monitoring'`

**Step 3: Write the implementation**

Create `src/lib/monitoring.ts`:

```typescript
import { db } from "@/server/db";
import { cronHeartbeats } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const NTFY_TOPIC = process.env.NTFY_TOPIC ?? "property-tracker-alerts";

/**
 * Send a push notification via ntfy.sh.
 * Fire-and-forget — never throws.
 */
export async function sendAlert(
  title: string,
  message: string,
  priority: "high" | "default" = "default"
): Promise<void> {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        Title: title,
        Priority: priority,
        Tags: priority === "high" ? "warning" : "white_check_mark",
      },
      body: message,
    });
  } catch {
    // Silent — alerting failure should never break the caller
  }
}

interface HeartbeatInput {
  status: "success" | "failure";
  durationMs: number;
  metadata?: Record<string, unknown>;
}

/**
 * Record a cron heartbeat. Upserts by cronName.
 * Fire-and-forget — never throws.
 */
export async function recordHeartbeat(
  cronName: string,
  input: HeartbeatInput
): Promise<void> {
  try {
    const now = new Date();
    await db
      .insert(cronHeartbeats)
      .values({
        cronName,
        lastRunAt: now,
        status: input.status,
        durationMs: input.durationMs,
        metadata: input.metadata ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: cronHeartbeats.cronName,
        set: {
          lastRunAt: now,
          status: input.status,
          durationMs: input.durationMs,
          metadata: input.metadata ?? null,
          updatedAt: now,
        },
      })
      .execute();
  } catch {
    // Silent — heartbeat failure should never break the cron
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/monitoring.test.ts`

Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/lib/monitoring.ts src/lib/__tests__/monitoring.test.ts
git commit -m "feat(monitoring): add sendAlert and recordHeartbeat utilities"
```

---

### Task 3: Enhanced Health Endpoint

**Files:**
- Create: `src/app/api/health/__tests__/route.test.ts`
- Modify: `src/app/api/health/route.ts`

**Step 1: Write the failing tests**

Create `src/app/api/health/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    execute: mockExecute,
  },
}));

import { GET } from "../route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with healthy status when DB is reachable", async () => {
    mockExecute.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
    expect(body).toHaveProperty("responseTimeMs");
    expect(body).toHaveProperty("timestamp");
  });

  it("returns 503 with unhealthy status when DB fails", async () => {
    mockExecute.mockRejectedValue(new Error("Connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("failed");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/health/__tests__/route.test.ts`

Expected: FAIL — current health route doesn't use `db.execute` or return `checks` field

**Step 3: Replace the health endpoint**

Replace the entire contents of `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check endpoint for uptime monitoring.
 * Returns 200 if app and database are healthy, 503 otherwise.
 * No auth required — this is a public monitoring endpoint.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    await db.execute(sql`SELECT 1`);
    const responseTimeMs = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: { database: "ok" },
      responseTimeMs,
    });
  } catch {
    const responseTimeMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: { database: "failed" },
        responseTimeMs,
      },
      { status: 503 }
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/health/__tests__/route.test.ts`

Expected: All 2 tests PASS

**Step 5: Commit**

```bash
git add src/app/api/health/route.ts src/app/api/health/__tests__/route.test.ts
git commit -m "feat(monitoring): enhanced health endpoint with DB connectivity check"
```

---

### Task 4: Uptime Check Cron

**Files:**
- Create: `src/app/api/cron/uptime-check/__tests__/route.test.ts`
- Create: `src/app/api/cron/uptime-check/route.ts`

**Step 1: Write the failing tests**

Create `src/app/api/cron/uptime-check/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockSendAlert = vi.fn();
vi.mock("@/lib/monitoring", () => ({
  sendAlert: (...args: unknown[]) => mockSendAlert(...args),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronRequest: vi.fn(() => true),
  unauthorizedResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  ),
}));

const mockLimit = vi.fn();
const mockSet = vi.fn(() => ({
  where: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));
const mockValuesReturn = vi.fn(() => ({
  execute: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockLimit,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: mockValuesReturn,
    })),
    update: vi.fn(() => ({
      set: mockSet,
    })),
  },
}));

import { GET } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/cron/uptime-check", {
    headers: { Authorization: "Bearer test-secret" },
  });
}

describe("GET /api/cron/uptime-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAlert.mockResolvedValue(undefined);
  });

  it("does not alert when status is healthy and was healthy before", async () => {
    // Health endpoint returns healthy
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy" }),
    });

    // Previous state was healthy
    mockLimit.mockResolvedValue([
      {
        id: "uptime",
        lastStatus: "healthy",
        lastCheckedAt: new Date(),
        failingSince: null,
        consecutiveFailures: 0,
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("healthy");
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("alerts when transitioning from healthy to unhealthy", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ status: "unhealthy" }),
    });

    mockLimit.mockResolvedValue([
      {
        id: "uptime",
        lastStatus: "healthy",
        lastCheckedAt: new Date(),
        failingSince: null,
        consecutiveFailures: 0,
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("unhealthy");
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.stringContaining("DOWN"),
      expect.any(String),
      "high"
    );
  });

  it("alerts on recovery from unhealthy to healthy", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "healthy" }),
    });

    const failingSince = new Date(Date.now() - 600_000); // 10 min ago
    mockLimit.mockResolvedValue([
      {
        id: "uptime",
        lastStatus: "unhealthy",
        lastCheckedAt: new Date(),
        failingSince,
        consecutiveFailures: 3,
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("healthy");
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.stringContaining("recovered"),
      expect.any(String),
      "default"
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/cron/uptime-check/__tests__/route.test.ts`

Expected: FAIL — `Cannot find module '../route'`

**Step 3: Write the implementation**

Create `src/app/api/cron/uptime-check/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { monitorState } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { sendAlert } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEALTH_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/api/health";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const now = new Date();
  let currentStatus: "healthy" | "unhealthy" = "unhealthy";

  // 1. Check health endpoint
  try {
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const body = await res.json();
      currentStatus = body.status === "healthy" ? "healthy" : "unhealthy";
    }
  } catch {
    currentStatus = "unhealthy";
  }

  // 2. Load previous state
  const [previousState] = await db
    .select()
    .from(monitorState)
    .where(eq(monitorState.id, "uptime"))
    .limit(1);

  const previousStatus = previousState?.lastStatus ?? "healthy";

  // 3. Detect transitions and alert
  if (previousStatus === "healthy" && currentStatus === "unhealthy") {
    await sendAlert(
      "[ALERT] PropertyTracker is DOWN",
      `Health check failed at ${now.toISOString()}. Investigating...`,
      "high"
    );
  } else if (previousStatus === "unhealthy" && currentStatus === "healthy") {
    const downSince = previousState?.failingSince;
    const duration = downSince
      ? Math.round((now.getTime() - downSince.getTime()) / 60_000)
      : 0;
    await sendAlert(
      "[OK] PropertyTracker recovered",
      `Site is back up. Was down for ~${duration} minutes.`,
      "default"
    );
  }

  // 4. Update state
  const consecutiveFailures =
    currentStatus === "unhealthy"
      ? (previousState?.consecutiveFailures ?? 0) + 1
      : 0;

  if (previousState) {
    await db
      .update(monitorState)
      .set({
        lastStatus: currentStatus,
        lastCheckedAt: now,
        failingSince:
          currentStatus === "unhealthy"
            ? previousState.failingSince ?? now
            : null,
        consecutiveFailures,
      })
      .where(eq(monitorState.id, "uptime"))
      .execute();
  } else {
    await db
      .insert(monitorState)
      .values({
        id: "uptime",
        lastStatus: currentStatus,
        lastCheckedAt: now,
        failingSince: currentStatus === "unhealthy" ? now : null,
        consecutiveFailures,
      })
      .execute();
  }

  return NextResponse.json({
    status: currentStatus,
    previousStatus,
    transitioned: previousStatus !== currentStatus,
    consecutiveFailures,
    timestamp: now.toISOString(),
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/cron/uptime-check/__tests__/route.test.ts`

Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/app/api/cron/uptime-check/
git commit -m "feat(monitoring): uptime check cron with ntfy transition alerts"
```

---

### Task 5: Cron Health Monitor

**Files:**
- Create: `src/app/api/cron/health-monitor/__tests__/route.test.ts`
- Create: `src/app/api/cron/health-monitor/route.ts`

**Step 1: Write the failing tests**

Create `src/app/api/cron/health-monitor/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendAlert = vi.fn();
vi.mock("@/lib/monitoring", () => ({
  sendAlert: (...args: unknown[]) => mockSendAlert(...args),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronRequest: vi.fn(() => true),
  unauthorizedResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  ),
}));

const mockDbResult = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        execute: mockDbResult,
      })),
    })),
  },
}));

import { GET } from "../route";

function makeRequest() {
  return new Request("http://localhost/api/cron/health-monitor", {
    headers: { Authorization: "Bearer test-secret" },
  });
}

describe("GET /api/cron/health-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAlert.mockResolvedValue(undefined);
  });

  it("reports all healthy when heartbeats are fresh", async () => {
    mockDbResult.mockResolvedValue([
      {
        cronName: "sync-banks",
        lastRunAt: new Date(), // just ran
        status: "success",
      },
      {
        cronName: "valuations",
        lastRunAt: new Date(), // just ran
        status: "success",
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.allHealthy).toBe(true);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("alerts for stale sync-banks heartbeat", async () => {
    const staleTime = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago
    mockDbResult.mockResolvedValue([
      {
        cronName: "sync-banks",
        lastRunAt: staleTime,
        status: "success",
      },
      {
        cronName: "valuations",
        lastRunAt: new Date(),
        status: "success",
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.allHealthy).toBe(false);
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.stringContaining("sync-banks"),
      expect.any(String),
      "high"
    );
  });

  it("alerts for missing heartbeat (no record exists)", async () => {
    mockDbResult.mockResolvedValue([]); // no heartbeats at all

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.allHealthy).toBe(false);
    expect(mockSendAlert).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/cron/health-monitor/__tests__/route.test.ts`

Expected: FAIL — `Cannot find module '../route'`

**Step 3: Write the implementation**

Create `src/app/api/cron/health-monitor/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { cronHeartbeats } from "@/server/db/schema";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { sendAlert } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staleness thresholds per cron.
 * If lastRunAt is older than this many hours, alert.
 */
const STALENESS_HOURS: Record<string, number> = {
  "sync-banks": 26, // daily at 6 AM, allow 2h drift
  valuations: 35 * 24, // monthly on 1st, allow 35 days
};

const MONITORED_CRONS = Object.keys(STALENESS_HOURS);

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const now = new Date();
  const heartbeats = await db.select().from(cronHeartbeats).execute();

  const heartbeatMap = new Map(
    heartbeats.map((h) => [h.cronName, h])
  );

  const results: Array<{
    cronName: string;
    status: "healthy" | "stale" | "missing";
    lastRunAt?: string;
    hoursAgo?: number;
  }> = [];

  const staleAlerts: string[] = [];

  for (const cronName of MONITORED_CRONS) {
    const heartbeat = heartbeatMap.get(cronName);
    const thresholdHours = STALENESS_HOURS[cronName]!;

    if (!heartbeat) {
      results.push({ cronName, status: "missing" });
      staleAlerts.push(
        `Cron '${cronName}' has never reported a heartbeat.`
      );
      continue;
    }

    const hoursAgo =
      (now.getTime() - heartbeat.lastRunAt.getTime()) / (1000 * 60 * 60);

    if (hoursAgo > thresholdHours) {
      results.push({
        cronName,
        status: "stale",
        lastRunAt: heartbeat.lastRunAt.toISOString(),
        hoursAgo: Math.round(hoursAgo),
      });
      staleAlerts.push(
        `Cron '${cronName}' last ran ${Math.round(hoursAgo)}h ago (threshold: ${thresholdHours}h).`
      );
    } else {
      results.push({
        cronName,
        status: "healthy",
        lastRunAt: heartbeat.lastRunAt.toISOString(),
        hoursAgo: Math.round(hoursAgo),
      });
    }
  }

  // Send a single alert if any crons are stale
  if (staleAlerts.length > 0) {
    await sendAlert(
      `[ALERT] ${staleAlerts.length} cron(s) missed: ${staleAlerts.map((_, i) => MONITORED_CRONS[i]).join(", ")}`,
      staleAlerts.join("\n"),
      "high"
    );
  }

  const allHealthy = staleAlerts.length === 0;

  return NextResponse.json({
    allHealthy,
    crons: results,
    timestamp: now.toISOString(),
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/cron/health-monitor/__tests__/route.test.ts`

Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/app/api/cron/health-monitor/
git commit -m "feat(monitoring): cron health monitor with staleness detection"
```

---

### Task 6: Heartbeat Integration

**Files:**
- Modify: `src/app/api/cron/sync-banks/route.ts`
- Modify: `src/app/api/cron/valuations/route.ts`

**Step 1: Add heartbeat to sync-banks**

Replace the entire `src/app/api/cron/sync-banks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { recordHeartbeat } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const startTime = Date.now();

  // Bank sync is handled via Basiq webhooks, not polling
  // This cron endpoint is kept for future use if we need scheduled syncs
  const result = {
    success: true,
    message: "Bank sync handled via webhooks - no action needed",
    timestamp: new Date().toISOString(),
  };

  await recordHeartbeat("sync-banks", {
    status: "success",
    durationMs: Date.now() - startTime,
    metadata: { message: result.message },
  });

  return NextResponse.json(result);
}
```

**Step 2: Add heartbeat to valuations**

In `src/app/api/cron/valuations/route.ts`, add the import at the top (after existing imports):

```typescript
import { recordHeartbeat } from "@/lib/monitoring";
```

Then add `const startTime = Date.now();` as the first line inside the `try` block (after `try {` on line 16).

Then add heartbeat recording just before the `return NextResponse.json({` on line 105. Insert:

```typescript
    await recordHeartbeat("valuations", {
      status: errors.length > 0 ? "failure" : "success",
      durationMs: Date.now() - startTime,
      metadata: { propertiesProcessed, valuationsCreated, backfilled, errorCount: errors.length },
    });
```

Also add a heartbeat in the outer `catch` block (line 113), before the return:

```typescript
    await recordHeartbeat("valuations", {
      status: "failure",
      durationMs: Date.now() - startTime,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });
```

Note: You'll need to move `const startTime = Date.now();` before the `try` block so it's accessible in the `catch`.

**Step 3: Run full test suite to verify no regressions**

Run: `npx vitest run`

Expected: All tests pass (existing + new)

**Step 4: Commit**

```bash
git add src/app/api/cron/sync-banks/route.ts src/app/api/cron/valuations/route.ts
git commit -m "feat(monitoring): add heartbeat recording to active crons"
```

---

### Task 7: Vercel Cron Configuration + Final Verification

**Files:**
- Modify: `vercel.json`

**Step 1: Add new crons to vercel.json**

Add two new entries to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/uptime-check",
  "schedule": "*/5 * * * *"
},
{
  "path": "/api/cron/health-monitor",
  "schedule": "0 7 * * *"
}
```

The full `crons` array should be:

```json
"crons": [
  {
    "path": "/api/cron/sync-banks",
    "schedule": "0 6 * * *"
  },
  {
    "path": "/api/cron/valuations",
    "schedule": "0 2 1 * *"
  },
  {
    "path": "/api/cron/uptime-check",
    "schedule": "*/5 * * * *"
  },
  {
    "path": "/api/cron/health-monitor",
    "schedule": "0 7 * * *"
  }
]
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass

**Step 4: Run lint**

Run: `npm run lint`

Expected: 0 errors

**Step 5: Run build**

Run: `npm run build`

Expected: Build succeeds. If sandbox restrictions block (e.g. `.next/lock`), ask user for `dangerouslyDisableSandbox` access.

**Step 6: Commit**

```bash
git add vercel.json
git commit -m "feat(monitoring): register uptime-check and health-monitor crons in vercel.json"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | `schema.ts`, migration | DB tables for heartbeats and monitor state |
| 2 | `src/lib/monitoring.ts` + tests | `sendAlert()` and `recordHeartbeat()` utilities |
| 3 | `src/app/api/health/route.ts` + tests | Enhanced health endpoint with DB check |
| 4 | `src/app/api/cron/uptime-check/` + tests | Uptime cron with transition alerts |
| 5 | `src/app/api/cron/health-monitor/` + tests | Cron staleness detection |
| 6 | `sync-banks/route.ts`, `valuations/route.ts` | Heartbeat integration into active crons |
| 7 | `vercel.json` | Register new crons |

**New env var:** `NTFY_TOPIC` (optional, defaults to `property-tracker-alerts`)

**Post-deploy:** Test by hitting `/api/health` to confirm DB check works. First uptime-check cron run will initialize `monitor_state`. First sync-banks/valuations run will populate `cron_heartbeats`.
