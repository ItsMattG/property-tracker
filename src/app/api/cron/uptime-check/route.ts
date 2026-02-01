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
      "[ALERT] BrickTrack is DOWN",
      `Health check failed at ${now.toISOString()}. Investigating...`,
      "high"
    );
  } else if (previousStatus === "unhealthy" && currentStatus === "healthy") {
    const downSince = previousState?.failingSince;
    const duration = downSince
      ? Math.round((now.getTime() - downSince.getTime()) / 60_000)
      : 0;
    await sendAlert(
      "[OK] BrickTrack recovered",
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
