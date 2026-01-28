import { nanoid } from "nanoid";

export function generateReferralCode(): string {
  return `REF-${nanoid(10)}`;
}
