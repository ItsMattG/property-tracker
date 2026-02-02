import { db } from "@/server/db";
import {
  emailConnections,
  emailApprovedSenders,
  senderPropertyHistory,
  propertyEmails,
  type EmailConnection,
  type EmailApprovedSender,
} from "@/server/db/schema";
import { eq, and, like, desc } from "drizzle-orm";
import { google } from "googleapis";
import { createAuthenticatedClient } from "@/lib/gmail/config";
import { getValidAccessToken, updateLastSync, markNeedsReauth } from "./gmail-token";
import type { GmailMessage, ParsedEmail } from "@/lib/gmail/types";

const MAX_MESSAGES_PER_SYNC = 50;

/**
 * Syncs emails for a single connection.
 */
export async function syncConnectionEmails(
  connection: EmailConnection
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    // Get valid access token
    const accessToken = await getValidAccessToken(connection);
    const auth = createAuthenticatedClient(accessToken);
    const gmail = google.gmail({ version: "v1", auth });

    // Get approved senders for this user
    const approvedSenders = await db
      .select()
      .from(emailApprovedSenders)
      .where(eq(emailApprovedSenders.userId, connection.userId));

    if (approvedSenders.length === 0) {
      return { synced: 0, errors: ["No approved senders configured"] };
    }

    // Build Gmail query from approved sender patterns
    const query = buildSenderQuery(approvedSenders, connection.lastSyncAt);

    // Fetch message list
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: MAX_MESSAGES_PER_SYNC,
    });

    const messages = listResponse.data.messages || [];

    // Process each message
    for (const msg of messages) {
      try {
        // Check if already synced (by external ID)
        const existing = await db
          .select({ id: propertyEmails.id })
          .from(propertyEmails)
          .where(
            and(
              eq(propertyEmails.userId, connection.userId),
              eq(propertyEmails.externalId, msg.id!)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue; // Already synced
        }

        // Fetch full message
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const parsed = parseGmailMessage(fullMessage.data as GmailMessage);

        // Check if sender matches approved patterns
        const matchedSender = findMatchingSender(parsed.from, approvedSenders);
        if (!matchedSender) {
          continue; // Sender not in approved list
        }

        // Determine property assignment
        const propertyId = await determinePropertyId(
          connection.userId,
          parsed.from,
          matchedSender.defaultPropertyId
        );

        // Store the email
        await db.insert(propertyEmails).values({
          propertyId,
          userId: connection.userId,
          fromAddress: parsed.from,
          fromName: parsed.fromName,
          subject: parsed.subject,
          bodyText: parsed.bodyText,
          bodyHtml: parsed.bodyHtml,
          messageId: parsed.id,
          receivedAt: parsed.date,
          source: "gmail",
          connectionId: connection.id,
          externalId: msg.id!,
          status: "approved",
          isRead: false,
        });

        synced++;
      } catch (msgError) {
        const errorMsg =
          msgError instanceof Error ? msgError.message : "Unknown error";
        errors.push(`Message ${msg.id}: ${errorMsg}`);
      }
    }

    // Update last sync timestamp
    await updateLastSync(connection.id);

    return { synced, errors };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("invalid_grant") ||
        error.message.includes("Token has been expired"))
    ) {
      await markNeedsReauth(connection.id, error.message);
    }
    throw error;
  }
}

/**
 * Syncs emails for all active connections of a user.
 */
export async function syncUserEmails(
  userId: string
): Promise<{ total: number; errors: string[] }> {
  const connections = await db
    .select()
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.userId, userId),
        eq(emailConnections.status, "active"),
        eq(emailConnections.provider, "gmail")
      )
    );

  let total = 0;
  const allErrors: string[] = [];

  for (const connection of connections) {
    try {
      const result = await syncConnectionEmails(connection);
      total += result.synced;
      allErrors.push(...result.errors);
    } catch (error) {
      allErrors.push(
        `Connection ${connection.emailAddress}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return { total, errors: allErrors };
}

/**
 * Syncs emails for all active connections (for cron job).
 */
export async function syncAllEmails(): Promise<{
  connections: number;
  emails: number;
  errors: string[];
}> {
  const connections = await db
    .select()
    .from(emailConnections)
    .where(
      and(
        eq(emailConnections.status, "active"),
        eq(emailConnections.provider, "gmail")
      )
    );

  let totalEmails = 0;
  const allErrors: string[] = [];

  for (const connection of connections) {
    try {
      const result = await syncConnectionEmails(connection);
      totalEmails += result.synced;
      allErrors.push(...result.errors);
    } catch (error) {
      allErrors.push(
        `Connection ${connection.id}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return {
    connections: connections.length,
    emails: totalEmails,
    errors: allErrors,
  };
}

/**
 * Builds a Gmail search query from approved sender patterns.
 */
function buildSenderQuery(
  senders: EmailApprovedSender[],
  sinceDate?: Date | null
): string {
  const fromClauses = senders.map((s) => {
    // Convert pattern like "*@raywhite.com" to Gmail query
    if (s.emailPattern.startsWith("*@")) {
      return `from:${s.emailPattern.substring(1)}`;
    }
    return `from:${s.emailPattern}`;
  });

  let query = `(${fromClauses.join(" OR ")})`;

  // Add date filter if we have a last sync date
  if (sinceDate) {
    const afterDate = Math.floor(sinceDate.getTime() / 1000);
    query += ` after:${afterDate}`;
  }

  return query;
}

/**
 * Parses a Gmail message into a simplified format.
 */
function parseGmailMessage(message: GmailMessage): ParsedEmail {
  const headers = message.payload.headers;

  const getHeader = (name: string): string | undefined => {
    const header = headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header?.value;
  };

  const from = getHeader("From") || "";
  const fromMatch = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);

  // Extract body
  let bodyText: string | undefined;
  let bodyHtml: string | undefined;

  const extractBody = (
    payload: GmailMessage["payload"]
  ): { text?: string; html?: string } => {
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, "base64").toString("utf8");
      if (payload.mimeType === "text/plain") {
        return { text: decoded };
      } else if (payload.mimeType === "text/html") {
        return { html: decoded };
      }
    }

    if (payload.parts) {
      let text: string | undefined;
      let html: string | undefined;
      for (const part of payload.parts) {
        const result = extractBody(part as GmailMessage["payload"]);
        if (result.text) text = result.text;
        if (result.html) html = result.html;
      }
      return { text, html };
    }

    return {};
  };

  const body = extractBody(message.payload);
  bodyText = body.text;
  bodyHtml = body.html;

  return {
    id: message.id,
    threadId: message.threadId,
    from: fromMatch?.[2] || from,
    fromName: fromMatch?.[1],
    subject: getHeader("Subject") || "(No Subject)",
    date: new Date(parseInt(message.internalDate)),
    bodyText,
    bodyHtml,
  };
}

/**
 * Checks if an email address matches any approved sender pattern.
 */
function findMatchingSender(
  email: string,
  senders: EmailApprovedSender[]
): EmailApprovedSender | undefined {
  const emailLower = email.toLowerCase();

  return senders.find((sender) => {
    const pattern = sender.emailPattern.toLowerCase();

    if (pattern.startsWith("*@")) {
      // Wildcard domain match
      const domain = pattern.substring(1);
      return emailLower.endsWith(domain);
    }

    // Exact match
    return emailLower === pattern;
  });
}

/**
 * Determines which property an email should be assigned to.
 * Priority: 1) Sender history 2) Sender default 3) null (unassigned)
 */
async function determinePropertyId(
  userId: string,
  senderAddress: string,
  senderDefaultPropertyId: string | null
): Promise<string | null> {
  // Check sender history first
  const history = await db
    .select()
    .from(senderPropertyHistory)
    .where(
      and(
        eq(senderPropertyHistory.userId, userId),
        eq(senderPropertyHistory.senderAddress, senderAddress.toLowerCase())
      )
    )
    .orderBy(desc(senderPropertyHistory.confidence))
    .limit(1);

  if (history.length > 0) {
    return history[0].propertyId;
  }

  // Fall back to sender's default property
  return senderDefaultPropertyId;
}

/**
 * Records a sender-property association for future matching.
 */
export async function recordSenderPropertyMatch(
  userId: string,
  senderAddress: string,
  propertyId: string,
  confidence: number = 1.0
): Promise<void> {
  await db
    .insert(senderPropertyHistory)
    .values({
      userId,
      senderAddress: senderAddress.toLowerCase(),
      propertyId,
      confidence,
    })
    .onConflictDoUpdate({
      target: [senderPropertyHistory.userId, senderPropertyHistory.senderAddress],
      set: {
        propertyId,
        confidence,
        updatedAt: new Date(),
      },
    });
}
