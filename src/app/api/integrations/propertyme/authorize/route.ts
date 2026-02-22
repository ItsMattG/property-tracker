import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getPropertyMeProvider } from "@/server/services/property-manager/propertyme";
import { createOAuthState, setOAuthNonceCookie } from "@/lib/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/sign-in", baseUrl));
  }

  const provider = getPropertyMeProvider();
  const { state, nonce } = createOAuthState(session.user.id);
  const redirectUri = `${baseUrl}/api/integrations/propertyme/callback`;
  const url = provider.getAuthUrl(redirectUri, state);

  const response = NextResponse.redirect(url);
  setOAuthNonceCookie("propertyme", nonce, response);

  return response;
}
