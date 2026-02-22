import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_MAX_AGE = 600; // 10 minutes

function cookieName(provider: string): string {
  return `oauth_nonce_${provider}`;
}

/**
 * Create an OAuth state parameter containing userId and a random nonce.
 */
export function createOAuthState(userId: string): {
  state: string;
  nonce: string;
} {
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(`${userId}:${nonce}`).toString("base64url");
  return { state, nonce };
}

/**
 * Set the OAuth nonce as an httpOnly cookie on the response.
 * Must be called during the OAuth init step (before redirect to provider).
 */
export function setOAuthNonceCookie(
  provider: string,
  nonce: string,
  response: NextResponse
): void {
  response.cookies.set(cookieName(provider), nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Validate the OAuth state parameter against the session userId and the
 * stored nonce cookie. Returns an error string if invalid, or null if valid.
 */
export function validateOAuthState(
  provider: string,
  state: string,
  sessionUserId: string,
  request: NextRequest
): string | null {
  const storedNonce = request.cookies.get(cookieName(provider))?.value;

  if (!storedNonce) {
    return "missing_nonce";
  }

  try {
    const decodedState = Buffer.from(state, "base64url").toString();
    const colonIndex = decodedState.indexOf(":");
    if (colonIndex === -1) return "invalid_state";

    const stateUserId = decodedState.slice(0, colonIndex);
    const stateNonce = decodedState.slice(colonIndex + 1);

    if (stateUserId !== sessionUserId) {
      return "user_mismatch";
    }

    if (stateNonce !== storedNonce) {
      return "nonce_mismatch";
    }

    return null;
  } catch {
    return "invalid_state";
  }
}

/**
 * Clear the OAuth nonce cookie on the response (call after validation).
 */
export function clearOAuthNonceCookie(
  provider: string,
  response: NextResponse
): void {
  response.cookies.delete(cookieName(provider));
}
