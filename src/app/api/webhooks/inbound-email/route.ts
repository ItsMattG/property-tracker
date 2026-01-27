import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { propertyEmails } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { resolveForwardingAddress } from "@/server/services/email-forwarding";
import { isSenderApproved } from "@/server/services/email-sender-check";
import { processEmailBackground } from "@/server/services/email-processing";
import { waitUntil } from "@vercel/functions";

export const runtime = "nodejs";

const INBOUND_SECRET = process.env.SENDGRID_INBOUND_SECRET;

function verifyBasicAuth(request: NextRequest): boolean {
  if (!INBOUND_SECRET) return process.env.NODE_ENV !== "production";

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
  // SendGrid sends username:password, we use a single secret as password
  const password = decoded.split(":")[1];
  return password === INBOUND_SECRET;
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyBasicAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    const to = (formData.get("to") as string) ?? "";
    const from = (formData.get("from") as string) ?? "";
    const subject = (formData.get("subject") as string) ?? "(No subject)";
    const text = formData.get("text") as string | null;
    const html = formData.get("html") as string | null;
    const headers = (formData.get("headers") as string) ?? "";

    // Parse from address — format: "Name <email>" or just "email"
    const fromMatch = from.match(/<([^>]+)>/) ?? [null, from.trim()];
    const fromAddress = fromMatch[1] ?? from.trim();
    const fromName = from.replace(/<[^>]+>/, "").trim() || null;

    // Parse to address to get the token
    const toMatch = to.match(/<([^>]+)>/) ?? [null, to.trim()];
    const toAddress = toMatch[1] ?? to.trim();

    // Resolve forwarding address → property
    const resolved = await resolveForwardingAddress(toAddress);
    if (!resolved) {
      // Unknown address — silently drop
      return NextResponse.json({ received: true });
    }

    const { propertyId, userId } = resolved;

    // Parse Message-ID and In-Reply-To from headers
    const messageIdMatch = headers.match(/^Message-ID:\s*<?([^>\r\n]+)>?/im);
    const inReplyToMatch = headers.match(/^In-Reply-To:\s*<?([^>\r\n]+)>?/im);
    const messageId = messageIdMatch?.[1] ?? null;
    const inReplyTo = inReplyToMatch?.[1] ?? null;

    // Deduplicate by message_id
    if (messageId) {
      const [existing] = await db
        .select({ id: propertyEmails.id })
        .from(propertyEmails)
        .where(eq(propertyEmails.messageId, messageId));

      if (existing) {
        return NextResponse.json({ received: true });
      }
    }

    // Compute thread_id
    let threadId: string | null = null;
    if (inReplyTo) {
      const [parent] = await db
        .select({ threadId: propertyEmails.threadId })
        .from(propertyEmails)
        .where(eq(propertyEmails.messageId, inReplyTo));

      threadId = parent?.threadId ?? inReplyTo;
    } else {
      threadId = messageId;
    }

    // Check sender allowlist
    const approved = await isSenderApproved(propertyId, fromAddress);
    const status = approved ? "approved" : "quarantined";

    // Store email
    const [email] = await db
      .insert(propertyEmails)
      .values({
        propertyId,
        userId,
        fromAddress,
        fromName,
        subject,
        bodyText: text,
        bodyHtml: html,
        messageId,
        inReplyTo,
        threadId,
        status,
        isRead: false,
        receivedAt: new Date(),
      })
      .returning();

    // Parse attachments from SendGrid multipart
    const attachments: { filename: string; contentType: string; content: Buffer }[] = [];
    const attachmentCount = parseInt((formData.get("attachments") as string) ?? "0", 10);

    for (let i = 1; i <= attachmentCount; i++) {
      const file = formData.get(`attachment${i}`) as File | null;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachments.push({
          filename: file.name,
          contentType: file.type,
          content: buffer,
        });
      }
    }

    // Background processing: attachments, invoice matching, notification
    if (email && status === "approved") {
      waitUntil(
        processEmailBackground({
          emailId: email.id,
          propertyId,
          userId,
          bodyText: text,
          subject,
          attachments,
        })
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Inbound email webhook error:", error);
    return NextResponse.json({ received: true });
  }
}
