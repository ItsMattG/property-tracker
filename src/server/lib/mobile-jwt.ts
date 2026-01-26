import { sign, verify } from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";
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
