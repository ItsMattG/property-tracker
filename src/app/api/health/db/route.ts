import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  try {
    // Simple query to test connection
    const result = await db.execute(sql`SELECT 1 as test, current_timestamp as ts`);
    const duration = Date.now() - start;

    return NextResponse.json({
      status: "ok",
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      db_url_length: process.env.DATABASE_URL?.length ?? 0,
      db_url_port: process.env.DATABASE_URL?.match(/:(\d+)\//)?.[1] ?? "unknown",
    });
  } catch (error) {
    const duration = Date.now() - start;

    return NextResponse.json({
      status: "error",
      duration_ms: duration,
      error: error instanceof Error ? error.message : String(error),
      db_url_length: process.env.DATABASE_URL?.length ?? 0,
      db_url_port: process.env.DATABASE_URL?.match(/:(\d+)\//)?.[1] ?? "unknown",
    }, { status: 500 });
  }
}
