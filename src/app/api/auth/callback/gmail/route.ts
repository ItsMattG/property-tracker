import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/server/db";
import { users, emailConnections } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createOAuth2Client } from "@/lib/gmail/config";
import { encrypt } from "@/lib/encryption";
import { google } from "googleapis";
import { validateOAuthState, clearOAuthNonceCookie } from "@/lib/oauth-state";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const settingsUrl = "/settings/email-connections";

  // Handle OAuth errors
  if (error) {
    logger.error("Gmail OAuth error", new Error(String(error)), { domain: "auth", provider: "gmail" });
    return NextResponse.redirect(
      new URL(`${settingsUrl}?error=${encodeURIComponent(error)}`, baseUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`${settingsUrl}?error=missing_params`, baseUrl)
    );
  }

  // Verify user is authenticated
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/sign-in", baseUrl));
  }

  // Validate state: userId must match session AND nonce must match cookie
  const stateError = validateOAuthState("gmail", state, session.user.id, request);
  if (stateError) {
    logger.error("Gmail OAuth state validation failed", new Error(stateError), { domain: "auth", provider: "gmail" });
    return NextResponse.redirect(
      new URL(`${settingsUrl}?error=invalid_state`, baseUrl)
    );
  }

  try {
    // Exchange code for tokens
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Missing tokens in OAuth response");
    }

    oauth2Client.setCredentials(tokens);

    // Get user's email address
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress;

    if (!emailAddress) {
      throw new Error("Could not retrieve email address");
    }

    // Get internal user ID
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id));

    if (!user) {
      throw new Error("User not found in database");
    }

    // Calculate token expiry
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600000); // Default 1 hour

    // Store encrypted tokens
    await db
      .insert(emailConnections)
      .values({
        userId: user.id,
        provider: "gmail",
        emailAddress,
        accessTokenEncrypted: encrypt(tokens.access_token),
        refreshTokenEncrypted: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [
          emailConnections.userId,
          emailConnections.provider,
          emailConnections.emailAddress,
        ],
        set: {
          accessTokenEncrypted: encrypt(tokens.access_token),
          refreshTokenEncrypted: encrypt(tokens.refresh_token),
          tokenExpiresAt: expiresAt,
          status: "active",
          lastError: null,
          updatedAt: new Date(),
        },
      });

    const response = NextResponse.redirect(
      new URL(`${settingsUrl}?success=gmail_connected`, baseUrl)
    );
    clearOAuthNonceCookie("gmail", response);
    return response;
  } catch (error) {
    logger.error("Gmail OAuth callback failed", error instanceof Error ? error : new Error(String(error)), { domain: "auth", provider: "gmail" });
    return NextResponse.redirect(
      new URL(`${settingsUrl}?error=oauth_failed`, baseUrl)
    );
  }
}
