import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, properties } from "@/server/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cache stats for 24 hours to reduce DB load
let cachedStats: { userCount: number; propertyCount: number } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Public stats endpoint for landing page.
 * Returns user and property counts.
 * Cached for 24 hours to reduce DB load.
 */
export async function GET() {
  const now = Date.now();

  // Return cached stats if still valid
  if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedStats, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    });
  }

  try {
    // Use Promise.race with a timeout to prevent hanging
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 3000)
    );

    const statsPromise = Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(properties),
    ]);

    const result = await Promise.race([statsPromise, timeout]);

    if (!result) {
      // Timeout - return cached or default
      return NextResponse.json(cachedStats ?? { userCount: 0, propertyCount: 0 }, {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
        },
      });
    }

    const [[userCountResult], [propertyCountResult]] = result;

    const stats = {
      userCount: userCountResult?.count ?? 0,
      propertyCount: propertyCountResult?.count ?? 0,
    };

    // Update cache
    cachedStats = stats;
    cacheTimestamp = now;

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    });
  } catch {
    // Return cached or default on error
    return NextResponse.json(cachedStats ?? { userCount: 0, propertyCount: 0 }, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    });
  }
}
