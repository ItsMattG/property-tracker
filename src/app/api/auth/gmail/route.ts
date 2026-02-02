import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthUrl } from "@/lib/gmail/config";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(
      new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Create state with user ID and random nonce for CSRF protection
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(`${userId}:${nonce}`).toString("base64url");

  const authUrl = getAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
