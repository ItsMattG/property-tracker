import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "@/lib/cron-auth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronRequest(request.headers)) {
    return unauthorizedResponse();
  }

  // TODO: Implement bank sync logic
  // This will be implemented when we build recurring transactions

  return NextResponse.json({
    success: true,
    message: "Bank sync cron executed",
    timestamp: new Date().toISOString(),
  });
}
