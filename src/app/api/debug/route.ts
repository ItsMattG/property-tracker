import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { users, properties, transactions } from "@/server/db/schema";
import { eq, and, count } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const simulate = url.searchParams.get("simulate") === "true";

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  const start = Date.now();
  results.baseline = `${Date.now() - start}ms`;

  // Test 1: Database ping
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    results.checks = { ...results.checks as Record<string, unknown>, database: { ok: true, time: `${Date.now() - dbStart}ms` } };
  } catch (e) {
    results.checks = { ...results.checks as Record<string, unknown>, database: { ok: false, error: String(e), time: `${Date.now() - dbStart}ms` } };
  }

  // Test 2: Clerk auth
  const authStart = Date.now();
  let clerkUserId: string | null = null;
  try {
    const authResult = await auth();
    clerkUserId = authResult.userId;
    results.checks = {
      ...results.checks as Record<string, unknown>,
      clerkAuth: {
        ok: true,
        userId: clerkUserId ? "present" : "null",
        time: `${Date.now() - authStart}ms`
      }
    };
  } catch (e) {
    results.checks = { ...results.checks as Record<string, unknown>, clerkAuth: { ok: false, error: String(e), time: `${Date.now() - authStart}ms` } };
  }

  // Test 3: Simulate protectedProcedure flow (if requested and authenticated)
  if (simulate && clerkUserId) {
    // This mimics what protectedProcedure does
    const userLookupStart = Date.now();
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkUserId),
      });
      results.checks = {
        ...results.checks as Record<string, unknown>,
        userLookup: {
          ok: true,
          found: !!user,
          userId: user?.id?.slice(0, 8) || "null",
          time: `${Date.now() - userLookupStart}ms`
        }
      };

      if (user) {
        // Simulate stats.dashboard query
        const statsStart = Date.now();
        const [propCount, txCount] = await Promise.all([
          db.select({ count: count() }).from(properties).where(eq(properties.userId, user.id)),
          db.select({ count: count() }).from(transactions).where(eq(transactions.userId, user.id)),
        ]);
        results.checks = {
          ...results.checks as Record<string, unknown>,
          statsQuery: {
            ok: true,
            properties: propCount[0]?.count || 0,
            transactions: txCount[0]?.count || 0,
            time: `${Date.now() - statsStart}ms`
          }
        };
      }
    } catch (e) {
      results.checks = { ...results.checks as Record<string, unknown>, userLookup: { ok: false, error: String(e), time: `${Date.now() - userLookupStart}ms` } };
    }
  } else if (simulate) {
    results.checks = { ...results.checks as Record<string, unknown>, simulate: { skipped: "not authenticated" } };
  }

  // Test 4: Axiom config
  const hasAxiom = !!process.env.AXIOM_TOKEN;
  results.checks = { ...results.checks as Record<string, unknown>, axiom: { configured: hasAxiom } };

  results.totalTime = `${Date.now() - start}ms`;

  return NextResponse.json(results);
}
