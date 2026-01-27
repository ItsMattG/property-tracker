import { db } from "@/server/db";
import { propertyEmailSenders } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if a sender email matches any approved pattern for a property.
 * Patterns can be exact (agent@raywhite.com) or domain wildcard (*@raywhite.com).
 */
export async function isSenderApproved(
  propertyId: string,
  fromAddress: string
): Promise<boolean> {
  const senders = await db
    .select({ emailPattern: propertyEmailSenders.emailPattern })
    .from(propertyEmailSenders)
    .where(eq(propertyEmailSenders.propertyId, propertyId));

  // If no senders configured, everything is quarantined
  if (senders.length === 0) return false;

  const normalizedFrom = fromAddress.toLowerCase().trim();

  return senders.some(({ emailPattern }) => {
    const pattern = emailPattern.toLowerCase().trim();

    if (pattern.startsWith("*@")) {
      // Domain wildcard: *@domain.com
      const domain = pattern.slice(2);
      return normalizedFrom.endsWith(`@${domain}`);
    }

    // Exact match
    return normalizedFrom === pattern;
  });
}
