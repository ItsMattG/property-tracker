import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

// Wrap POST to diagnose and surface 500 errors
export async function POST(req: NextRequest) {
  try {
    const response = await handler.POST(req);

    // If BetterAuth returns 500, clone the response and append diagnostic info
    if (response.status >= 500) {
      const body = await response.clone().text();
      return NextResponse.json(
        {
          _debug: true,
          originalStatus: response.status,
          originalBody: body || "(empty)",
          url: req.url,
          method: req.method,
        },
        { status: 500 }
      );
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        _debug: true,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 8) : undefined,
      },
      { status: 500 }
    );
  }
}
