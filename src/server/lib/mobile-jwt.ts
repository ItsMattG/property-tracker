import { sign, verify } from "jsonwebtoken";

export const JWT_EXPIRES_IN = "30d";

export interface MobileJwtPayload {
  userId: string;
  email: string;
  /** Password version — first 8 chars of bcrypt hash, used to invalidate tokens on password change */
  pwv?: string;
}

/**
 * Get JWT secret, throwing if not configured.
 * Check is deferred to runtime to allow builds without the env var.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export function verifyMobileToken(token: string): MobileJwtPayload {
  return verify(token, getJwtSecret()) as MobileJwtPayload;
}

/**
 * Extract password version from bcrypt hash (first 8 chars after the algorithm prefix).
 * Used to tie tokens to the current password — changing password invalidates all tokens.
 */
export function getPasswordVersion(hash: string): string {
  return hash.slice(0, 16);
}

export function signMobileToken(payload: MobileJwtPayload): string {
  return sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}
