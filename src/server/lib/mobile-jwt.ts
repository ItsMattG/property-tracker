import { sign, verify } from "jsonwebtoken";

// Security: JWT_SECRET must be explicitly set - no weak default
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const JWT_SECRET = secret;
export const JWT_EXPIRES_IN = "30d";

export interface MobileJwtPayload {
  userId: string;
  email: string;
}

export function verifyMobileToken(token: string): MobileJwtPayload {
  return verify(token, JWT_SECRET) as MobileJwtPayload;
}

export function signMobileToken(payload: MobileJwtPayload): string {
  return sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
