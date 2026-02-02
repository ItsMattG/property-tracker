import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";
import { recordHeartbeat } from "@/lib/monitoring";
import { syncAllEmails } from "@/server/services/gmail-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    const result = await syncAllEmails();

    const status = result.errors.length > 0 ? "partial" : "success";

    await recordHeartbeat("email-sync", {
      status: result.errors.length > 0 ? "failure" : "success",
      durationMs: Date.now() - startTime,
      metadata: {
        connections: result.connections,
        emails: result.emails,
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 5), // Limit to first 5 errors
      },
    });

    return NextResponse.json({
      success: true,
      status,
      connections: result.connections,
      emailsSynced: result.emails,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await recordHeartbeat("email-sync", {
      status: "failure",
      durationMs: Date.now() - startTime,
      metadata: { error: errorMessage },
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
