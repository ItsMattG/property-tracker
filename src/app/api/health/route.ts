import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check endpoint for uptime monitoring.
 * Returns 200 if the application and database are healthy.
 * Returns 503 if the database connection fails.
 *
 * Configure your uptime monitor (BetterUptime, UptimeRobot, etc.)
 * to ping this endpoint every 3-5 minutes.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connectivity with a simple query
    await db.execute(sql`SELECT 1`);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: "ok",
      },
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: "failed",
        },
        responseTime: `${responseTime}ms`,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
