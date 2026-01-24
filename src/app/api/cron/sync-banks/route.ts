import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Implement bank sync logic
  // This will be implemented when we build recurring transactions

  return NextResponse.json({
    success: true,
    message: "Bank sync cron executed",
    timestamp: new Date().toISOString(),
  });
}
