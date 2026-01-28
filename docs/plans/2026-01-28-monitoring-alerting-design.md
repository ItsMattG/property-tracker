# Monitoring & Alerting Design (v0.4 Phase 4.3)

**Date:** 2026-01-28
**Status:** Approved

## Goal

Self-contained monitoring and alerting with no external SaaS dependencies. Uptime checks, cron health monitoring, and ntfy.sh push notifications on failures.

## Existing Infrastructure

- **Sentry:** Client, server, edge — error tracking, source maps, replay
- **Axiom:** Structured logging with metrics helpers
- **Health endpoint:** `/api/health` — stub returning `{"status":"ok"}`, no DB check
- **12 cron routes:** 2 scheduled in Vercel (sync-banks daily 6 AM, valuations monthly 1st 2 AM), all secured with `CRON_SECRET`
- **ntfy.sh:** Referenced in project config, not yet implemented

## Architecture

Three components:

1. **Enhanced Health Endpoint** — Upgrade `/api/health` to check database connectivity. Return 200 with response time when healthy, 503 when unhealthy.

2. **Uptime Monitor Cron** — `/api/cron/uptime-check` every 5 minutes. Calls `/api/health`, detects state transitions (healthy→unhealthy, unhealthy→healthy), sends ntfy alerts. Tracks state in `monitor_state` table to avoid alert spam.

3. **Cron Health Monitor** — `/api/cron/health-monitor` daily at 7 AM. Checks `cron_heartbeats` table for staleness. Each active cron writes a heartbeat after completion. Alert if a cron missed its expected window.

## Data Model

### `cron_heartbeats`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| cronName | text, unique | "sync-banks" or "valuations" |
| lastRunAt | timestamp | When it last completed |
| status | text | "success" or "failure" |
| durationMs | integer | Execution time |
| metadata | jsonb, nullable | Records processed, errors, etc. |
| updatedAt | timestamp | |

Staleness thresholds:
- `sync-banks`: 26 hours (daily, allows drift)
- `valuations`: 35 days (monthly)

### `monitor_state`

| Column | Type | Description |
|--------|------|-------------|
| id | text, PK | "uptime" |
| lastStatus | text | "healthy" or "unhealthy" |
| lastCheckedAt | timestamp | |
| failingSince | timestamp, nullable | |
| consecutiveFailures | integer, default 0 | |

## Alert Channel

ntfy.sh via simple HTTP POST. No SDK needed.

```typescript
async function sendAlert(title: string, message: string, priority?: "high" | "default") {
  await fetch("https://ntfy.sh/property-tracker-alerts", {
    method: "POST",
    headers: { Title: title, Priority: priority ?? "default" },
    body: message,
  });
}
```

### Alert Messages

- **Site down:** `[ALERT] PropertyTracker is DOWN` (priority: high)
- **Site recovered:** `[OK] PropertyTracker recovered — was down for {duration}` (priority: default)
- **Missed cron:** `[ALERT] Cron '{name}' missed — last ran {time}, expected within {threshold}` (priority: high)

Alerts fire on state transitions only — no spam during sustained outages.

## Cron Routes

### `/api/cron/uptime-check` (every 5 min)

1. Protected by `CRON_SECRET`
2. Fetch `/api/health`
3. Read `monitor_state`
4. Detect transition → send ntfy alert
5. Update `monitor_state`

### `/api/cron/health-monitor` (daily 7 AM)

1. Protected by `CRON_SECRET`
2. Query `cron_heartbeats` for sync-banks and valuations
3. Compare `lastRunAt` against staleness thresholds
4. Alert for any stale crons

## Heartbeat Integration

Add `recordHeartbeat()` call to end of `sync-banks/route.ts` and `valuations/route.ts`. Fire-and-forget — heartbeat failure doesn't affect cron execution.

## Files

| Action | File |
|--------|------|
| Create | `src/lib/monitoring.ts` |
| Create | `src/server/db/schema/monitoring.ts` |
| Modify | `src/server/db/schema/index.ts` |
| Create | DB migration |
| Modify | `src/app/api/health/route.ts` |
| Create | `src/app/api/cron/uptime-check/route.ts` |
| Create | `src/app/api/cron/health-monitor/route.ts` |
| Modify | `src/app/api/cron/sync-banks/route.ts` |
| Modify | `src/app/api/cron/valuations/route.ts` |
| Modify | `vercel.json` |
| Create | Unit tests for all new modules |

## Testing

- Unit tests for `sendAlert()`, `recordHeartbeat()`, uptime-check route, health-monitor route, enhanced health endpoint
- No E2E tests — internal monitoring routes, not user-facing

## Decisions

- **ntfy.sh only** — no Slack. Already referenced in project, simple HTTP, free push notifications.
- **Self-contained** — no Checkly or external SaaS. Vercel cron + ntfy.sh.
- **2 active crons only** — sync-banks and valuations. Other 10 routes are event-triggered.
