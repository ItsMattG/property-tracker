import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { properties } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const FORWARDING_DOMAIN = process.env.EMAIL_FORWARDING_DOMAIN || "inbox.propertytracker.com.au";

export function generateForwardingToken(): string {
  return `prop_${nanoid(12)}`;
}

export function getFullForwardingAddress(token: string): string {
  return `${token}@${FORWARDING_DOMAIN}`;
}

export async function ensureForwardingAddress(propertyId: string): Promise<string> {
  const [property] = await db
    .select({ forwardingAddress: properties.forwardingAddress })
    .from(properties)
    .where(eq(properties.id, propertyId));

  if (property?.forwardingAddress) {
    return getFullForwardingAddress(property.forwardingAddress);
  }

  const token = generateForwardingToken();
  await db
    .update(properties)
    .set({ forwardingAddress: token })
    .where(eq(properties.id, propertyId));

  return getFullForwardingAddress(token);
}

export async function regenerateForwardingAddress(propertyId: string): Promise<string> {
  const token = generateForwardingToken();
  await db
    .update(properties)
    .set({ forwardingAddress: token })
    .where(eq(properties.id, propertyId));

  return getFullForwardingAddress(token);
}

export async function resolveForwardingAddress(
  toAddress: string
): Promise<{ propertyId: string; userId: string } | null> {
  const token = toAddress.split("@")[0];
  if (!token) return null;

  const [property] = await db
    .select({ propertyId: properties.id, userId: properties.userId })
    .from(properties)
    .where(eq(properties.forwardingAddress, token));

  return property ?? null;
}
