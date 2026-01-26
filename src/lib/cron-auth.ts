import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Verify cron request using timing-safe comparison
 */
export function verifyCronRequest(headers: Headers): boolean {
  if (!CRON_SECRET) {
    return false;
  }

  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);

  try {
    // Pad to same length for timing-safe comparison
    const tokenBuffer = Buffer.from(token.padEnd(256, "\0"));
    const secretBuffer = Buffer.from(CRON_SECRET.padEnd(256, "\0"));

    return (
      timingSafeEqual(tokenBuffer, secretBuffer) &&
      token.length === CRON_SECRET.length
    );
  } catch {
    return false;
  }
}

/**
 * Standard unauthorized response for cron routes
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
