import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { seed } from "@/lib/seed";
import type { SeedMode } from "@/lib/seed";

export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed endpoint is not available in production" }, { status: 403 });
  }

  // Require authentication
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mode = body.mode as SeedMode;
    const clean = body.options?.clean ?? false;

    if (!mode || !["demo", "dev"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode. Use 'demo' or 'dev'" }, { status: 400 });
    }

    const summary = await seed({
      clerkId,
      mode,
      clean,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Seed API error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
