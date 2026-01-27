import { db } from "@/server/db";
import {
  propertyEmailAttachments,
  propertyEmailInvoiceMatches,
  documents,
  transactions,
} from "@/server/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface AttachmentData {
  filename: string;
  contentType: string;
  content: Buffer;
}

interface ProcessEmailOptions {
  emailId: number;
  propertyId: string;
  userId: string;
  bodyText: string | null;
  subject: string;
  attachments: AttachmentData[];
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

export async function processEmailBackground(options: ProcessEmailOptions) {
  await extractAttachments(options);
  await matchInvoices(options);
}

async function extractAttachments({
  emailId,
  propertyId,
  userId,
  attachments,
}: ProcessEmailOptions) {
  const supabase = getSupabaseAdmin();

  for (const attachment of attachments) {
    if (attachment.content.length > MAX_ATTACHMENT_SIZE) {
      console.log(`Skipping oversized attachment: ${attachment.filename} (${attachment.content.length} bytes)`);
      continue;
    }

    const timestamp = Date.now();
    const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${userId}/${propertyId}/emails/${emailId}/${timestamp}-${sanitizedFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, attachment.content, {
        contentType: attachment.contentType,
      });

    if (uploadError) {
      console.error(`Failed to upload attachment ${attachment.filename}:`, uploadError);
      continue;
    }

    // Create document record
    const [doc] = await db
      .insert(documents)
      .values({
        userId,
        propertyId,
        storagePath,
        fileName: attachment.filename,
        fileType: attachment.contentType,
        fileSize: String(attachment.content.length),
        category: "other",
      })
      .returning();

    // Create attachment record
    await db.insert(propertyEmailAttachments).values({
      emailId,
      filename: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.content.length,
      storagePath,
      documentId: doc?.id,
    });
  }
}

async function matchInvoices({
  emailId,
  propertyId,
  bodyText,
  subject,
}: ProcessEmailOptions) {
  // Extract dollar amounts from subject and body
  const textToScan = `${subject} ${bodyText ?? ""}`;
  const amountRegex = /\$[\d,]+\.?\d*/g;
  const matches = textToScan.match(amountRegex);

  if (!matches || matches.length === 0) return;

  const amounts = [...new Set(
    matches.map((m) => parseFloat(m.replace(/[$,]/g, ""))).filter((a) => a > 0 && a < 1_000_000)
  )];

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (const amount of amounts) {
    const lowerBound = (amount * 0.8).toFixed(2);
    const upperBound = (amount * 1.2).toFixed(2);

    const matchedTransactions = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.propertyId, propertyId),
          gte(transactions.date, ninetyDaysAgo.toISOString().split("T")[0]!),
          lte(transactions.date, now.toISOString().split("T")[0]!),
          sql`abs(${transactions.amount}::numeric) BETWEEN ${lowerBound}::numeric AND ${upperBound}::numeric`
        )
      )
      .limit(5);

    for (const txn of matchedTransactions) {
      const txnAmount = Math.abs(parseFloat(String(txn.amount)));
      const diff = Math.abs(txnAmount - amount) / amount;

      let confidence: number;
      if (diff < 0.01) {
        // Exact match
        confidence = 0.9;
      } else if (diff < 0.05) {
        confidence = 0.7;
      } else {
        confidence = 0.4;
      }

      if (confidence >= 0.5) {
        await db.insert(propertyEmailInvoiceMatches).values({
          emailId,
          transactionId: txn.id,
          confidence,
          amountDetected: String(amount),
          status: "pending",
        });
      }
    }
  }
}
