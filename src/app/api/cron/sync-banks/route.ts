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
