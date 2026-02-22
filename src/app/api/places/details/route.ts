import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { apiRateLimiter } from "@/server/middleware/rate-limit";
import { logger } from "@/lib/logger";

const log = logger.child({ domain: "places" });

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await apiRateLimiter.check(`places:${session.user.id}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const placeId = body?.placeId;
    if (!placeId || typeof placeId !== "string") {
      return NextResponse.json({ error: "Invalid placeId" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      log.error("GOOGLE_PLACES_API_KEY is not configured");
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "addressComponents,location",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      log.error("Google Places details API error", new Error(`Status ${response.status}`), {
        status: response.status,
        userId: session.user.id,
        placeId,
      });
      return NextResponse.json({ error: "Places API error" }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    log.error("Places details proxy error", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
