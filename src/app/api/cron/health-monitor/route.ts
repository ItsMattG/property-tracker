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

  const heartbeatMap = new Map(heartbeats.map((h) => [h.cronName, h]));

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
    const staleCronNames = results
      .filter((r) => r.status !== "healthy")
      .map((r) => r.cronName);
    await sendAlert(
      `[ALERT] ${staleAlerts.length} cron(s) missed: ${staleCronNames.join(", ")}`,
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
