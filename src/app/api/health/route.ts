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
