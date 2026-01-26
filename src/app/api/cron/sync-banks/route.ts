import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  // Bank sync is handled via Basiq webhooks, not polling
  // This cron endpoint is kept for future use if we need scheduled syncs
  return NextResponse.json({
    success: true,
    message: "Bank sync handled via webhooks - no action needed",
    timestamp: new Date().toISOString(),
  });
}
