import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Test 1: Simple response (baseline)
  const start = Date.now();
  results.baseline = `${Date.now() - start}ms`;

  // Test 2: Database query
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    results.checks = { ...results.checks as Record<string, unknown>, database: { ok: true, time: `${Date.now() - dbStart}ms` } };
  } catch (e) {
    results.checks = { ...results.checks as Record<string, unknown>, database: { ok: false, error: String(e), time: `${Date.now() - dbStart}ms` } };
  }

  // Test 3: Clerk auth
  const authStart = Date.now();
  try {
    const authResult = await auth();
    results.checks = {
      ...results.checks as Record<string, unknown>,
      clerkAuth: {
        ok: true,
        userId: authResult.userId ? "present" : "null",
        time: `${Date.now() - authStart}ms`
      }
    };
  } catch (e) {
    results.checks = { ...results.checks as Record<string, unknown>, clerkAuth: { ok: false, error: String(e), time: `${Date.now() - authStart}ms` } };
  }

  // Test 4: Axiom (if configured)
  const axiomStart = Date.now();
  const hasAxiom = !!process.env.AXIOM_TOKEN;
  results.checks = { ...results.checks as Record<string, unknown>, axiom: { configured: hasAxiom, time: `${Date.now() - axiomStart}ms` } };

  results.totalTime = `${Date.now() - start}ms`;

  return NextResponse.json(results);
}
