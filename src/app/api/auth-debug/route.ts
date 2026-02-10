import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

// Temporary diagnostic endpoint to debug auth 500 errors
// DELETE THIS AFTER DEBUGGING
export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: Can we reach the database?
  try {
    const dbResult = await db.execute(sql`SELECT 1 as ok`);
    results.dbConnection = { ok: true, rows: dbResult.length };
  } catch (e) {
    results.dbConnection = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Test 2: Can we query the users table?
  try {
    const users = await db.execute(sql`SELECT count(*) as count FROM public.users`);
    results.usersTable = { ok: true, data: users[0] };
  } catch (e) {
    results.usersTable = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Test 3: Can we query the session table?
  try {
    const sessions = await db.execute(sql`SELECT count(*) as count FROM public.session`);
    results.sessionTable = { ok: true, data: sessions[0] };
  } catch (e) {
    results.sessionTable = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Test 4: Try BetterAuth internal signIn
  try {
    await auth.api.signInEmail({
      body: { email: "probe-test@example.com", password: "testpassword123" },
    });
    results.signIn = { ok: true, result: "unexpected success" };
  } catch (e) {
    const err = e instanceof Error ? e : { message: String(e) };
    results.signIn = {
      ok: false,
      error: (err as Error).message,
      name: (err as Error).name,
      stack: (err as Error).stack?.split("\n").slice(0, 10),
    };
  }

  // Test 5: Environment variables check
  results.env = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + "...",
    hasBetterAuthSecret: !!process.env.BETTER_AUTH_SECRET,
    betterAuthUrl: process.env.BETTER_AUTH_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };

  return NextResponse.json(results, { status: 200 });
}
