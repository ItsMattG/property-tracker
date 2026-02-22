import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getAuthUrl } from "@/lib/gmail/config";
import { createOAuthState, setOAuthNonceCookie } from "@/lib/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user) {
    return NextResponse.redirect(
      new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  const { state, nonce } = createOAuthState(session.user.id);
  const authUrl = getAuthUrl(state);
  const response = NextResponse.redirect(authUrl);
  setOAuthNonceCookie("gmail", nonce, response);

  return response;
}
