import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { seed } from "@/lib/seed";
import type { SeedMode } from "@/lib/seed";

export async function POST(request: NextRequest) {
  // Block in production (allow staging/preview via VERCEL_GIT_COMMIT_REF)
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
  const isProductionBranch = !gitBranch || gitBranch === "main";
  if (process.env.NODE_ENV === "production" && isProductionBranch) {
    return NextResponse.json({ error: "Seed endpoint is not available in production" }, { status: 403 });
  }

  // Require authentication
  const session = await getAuthSession();
  if (!session?.user) {
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
      email: session.user.email,
      mode,
      clean,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error("Seed operation failed", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: "Seed operation failed",
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      { status: 500 }
    );
  }
}
