import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

// Wrap POST to capture and log errors for debugging
export async function POST(req: NextRequest) {
  try {
    return await handler.POST(req);
  } catch (error) {
    console.error("[auth] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined },
      { status: 500 }
    );
  }
}
