import { db } from "@/server/db";
import { cronHeartbeats } from "@/server/db/schema";

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
