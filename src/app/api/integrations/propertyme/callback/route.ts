import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/server/db";
import { propertyManagerConnections, users } from "@/server/db/schema";
import { getPropertyMeProvider } from "@/server/services/property-manager/propertyme";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";
import { validateOAuthState, clearOAuthNonceCookie } from "@/lib/oauth-state";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user) {
    return NextResponse.redirect(
      new URL("/sign-in?error=unauthorized", request.url)
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${error}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=missing_params", request.url)
    );
  }

  // Validate state: userId must match session AND nonce must match cookie
  const stateError = validateOAuthState("propertyme", state, session.user.id, request);
  if (stateError) {
    logger.error("PropertyMe OAuth state validation failed", new Error(stateError), { domain: "integrations", provider: "propertyme" });
    return NextResponse.redirect(
      new URL("/settings/integrations?error=invalid_state", request.url)
    );
  }

  try {
    const provider = getPropertyMeProvider();
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/propertyme/callback`;

    const tokens = await provider.exchangeCodeForTokens(code, redirectUri);

    // Get the user from our database
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.redirect(
        new URL("/settings/integrations?error=user_not_found", request.url)
      );
    }

    // Create connection record
    const [connection] = await db
      .insert(propertyManagerConnections)
      .values({
        userId: user.id,
        provider: "propertyme",
        providerUserId: tokens.userId,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : null,
        scopes: ["property", "activity", "contact", "transaction"],
        status: "active",
      })
      .returning();

    const response = NextResponse.redirect(
      new URL(
        `/settings/integrations/propertyme?connection=${connection.id}`,
        request.url
      )
    );
    clearOAuthNonceCookie("propertyme", response);
    return response;
  } catch (err) {
    logger.error("PropertyMe OAuth callback failed", err instanceof Error ? err : new Error(String(err)), { domain: "integrations", provider: "propertyme" });
    return NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_failed", request.url)
    );
  }
}
