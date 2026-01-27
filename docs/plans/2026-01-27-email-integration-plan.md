# Email Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-property email forwarding so users can forward property-related emails into PropertyTracker, with attachment extraction, invoice matching, and notifications.

**Architecture:** SendGrid Inbound Parse receives emails at `prop_{token}@inbox.propertytracker.com.au` and POSTs parsed content to a webhook. The webhook stores emails, then uses `waitUntil()` for background attachment extraction (Supabase storage), invoice matching, and notifications. A sender allowlist with quarantine protects against spam.

**Tech Stack:** Next.js API routes, Drizzle ORM, tRPC, SendGrid Inbound Parse, Supabase Storage, nanoid, isomorphic-dompurify

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install nanoid and dompurify**

```bash
npm install nanoid isomorphic-dompurify
npm install -D @types/dompurify
```

**Step 2: Verify installation**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add nanoid and isomorphic-dompurify deps"
```

---

### Task 2: Database Schema — Enums and Tables

**Files:**
- Modify: `src/server/db/schema.ts` (lines 436, 985, 2768)

**Step 1: Add enum and table imports**

In `src/server/db/schema.ts`, the pg-core import at line 1 already has `serial`. Add `real` to the pg-core import if not already present. Verify `sql` is imported from `drizzle-orm` (line 2).

**Step 2: Add email status enum**

After line 436 (after `blogCategoryEnum` closing), add:

```typescript
export const emailStatusEnum = pgEnum("email_status", [
  "quarantined",
  "approved",
  "rejected",
]);

export const invoiceMatchStatusEnum = pgEnum("invoice_match_status", [
  "pending",
  "accepted",
  "rejected",
]);
```

**Step 3: Add forwarding_address column to properties table**

In the `properties` table (line 667-687), add after the `climateRisk` field (line 684):

```typescript
  forwardingAddress: text("forwarding_address").unique(),
```

**Step 4: Add email tables**

After line 985 (after `propertyManagerSyncLogs` closing), add:

```typescript
export const propertyEmails = pgTable("property_emails", {
  id: serial("id").primaryKey(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  fromAddress: text("from_address").notNull(),
  fromName: text("from_name"),
  subject: text("subject").notNull(),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  messageId: text("message_id").unique(),
  inReplyTo: text("in_reply_to"),
  threadId: text("thread_id"),
  status: emailStatusEnum("status").default("approved").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  receivedAt: timestamp("received_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyEmailAttachments = pgTable("property_email_attachments", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id")
    .references(() => propertyEmails.id, { onDelete: "cascade" })
    .notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyEmailInvoiceMatches = pgTable("property_email_invoice_matches", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id")
    .references(() => propertyEmails.id, { onDelete: "cascade" })
    .notNull(),
  transactionId: uuid("transaction_id")
    .references(() => transactions.id, { onDelete: "cascade" })
    .notNull(),
  confidence: real("confidence").notNull(),
  amountDetected: decimal("amount_detected", { precision: 12, scale: 2 }).notNull(),
  status: invoiceMatchStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyEmailSenders = pgTable(
  "property_email_senders",
  {
    id: serial("id").primaryKey(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    emailPattern: text("email_pattern").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("property_email_senders_property_pattern_idx").on(
      table.propertyId,
      table.emailPattern
    ),
  ]
);
```

**Step 5: Add type exports**

After line 2768 (after `NewBlogPost`), add:

```typescript
// Email Types
export type PropertyEmail = typeof propertyEmails.$inferSelect;
export type NewPropertyEmail = typeof propertyEmails.$inferInsert;
export type PropertyEmailAttachment = typeof propertyEmailAttachments.$inferSelect;
export type NewPropertyEmailAttachment = typeof propertyEmailAttachments.$inferInsert;
export type PropertyEmailInvoiceMatch = typeof propertyEmailInvoiceMatches.$inferSelect;
export type NewPropertyEmailInvoiceMatch = typeof propertyEmailInvoiceMatches.$inferInsert;
export type PropertyEmailSender = typeof propertyEmailSenders.$inferSelect;
export type NewPropertyEmailSender = typeof propertyEmailSenders.$inferInsert;
```

**Step 6: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add src/server/db/schema.ts
git commit -m "feat(email): add database schema for property email forwarding"
```

---

### Task 3: Forwarding Address Generation Service

**Files:**
- Create: `src/server/services/email-forwarding.ts`

**Step 1: Create the service**

```typescript
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
    .select({ id: properties.id, userId: properties.userId })
    .from(properties)
    .where(eq(properties.forwardingAddress, token));

  return property ?? null;
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/email-forwarding.ts
git commit -m "feat(email): add forwarding address generation service"
```

---

### Task 4: Sender Allowlist Service

**Files:**
- Create: `src/server/services/email-sender-check.ts`

**Step 1: Create the service**

```typescript
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
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/email-sender-check.ts
git commit -m "feat(email): add sender allowlist checking service"
```

---

### Task 5: Email Processing Service (Attachments + Invoice Matching)

**Files:**
- Create: `src/server/services/email-processing.ts`

**Step 1: Create the processing service**

```typescript
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
        fileSize: attachment.content.length,
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
          gte(transactions.date, ninetyDaysAgo.toISOString().split("T")[0]),
          lte(transactions.date, now.toISOString().split("T")[0]),
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
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: May have errors if `documents` table schema doesn't match — adjust column names to match the actual `documents` table definition. Check the schema for the correct column names.

**Step 3: Commit**

```bash
git add src/server/services/email-processing.ts
git commit -m "feat(email): add email processing service for attachments and invoice matching"
```

---

### Task 6: Inbound Email Webhook

**Files:**
- Create: `src/app/api/webhooks/inbound-email/route.ts`

**Step 1: Create the webhook handler**

```typescript
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
```

**Step 2: Install @vercel/functions if not already present**

```bash
npm install @vercel/functions
```

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/webhooks/inbound-email/route.ts package.json package-lock.json
git commit -m "feat(email): add inbound email webhook handler"
```

---

### Task 7: tRPC Email Router

**Files:**
- Create: `src/server/routers/email.ts`
- Modify: `src/server/routers/_app.ts` (lines 40-41, 81)

**Step 1: Create the email router**

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  propertyEmails,
  propertyEmailAttachments,
  propertyEmailInvoiceMatches,
  propertyEmailSenders,
  properties,
} from "../db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  ensureForwardingAddress,
  regenerateForwardingAddress,
} from "../services/email-forwarding";
import { processEmailBackground } from "../services/email-processing";

export const emailRouter = router({
  // List emails for a property or all properties
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        status: z.enum(["approved", "quarantined", "rejected"]).optional(),
        unreadOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(propertyEmails.userId, ctx.portfolio.ownerId)];

      if (input.propertyId) {
        conditions.push(eq(propertyEmails.propertyId, input.propertyId));
      }
      if (input.status) {
        conditions.push(eq(propertyEmails.status, input.status));
      }
      if (input.unreadOnly) {
        conditions.push(eq(propertyEmails.isRead, false));
      }
      if (input.cursor) {
        conditions.push(sql`${propertyEmails.id} < ${input.cursor}`);
      }

      const emails = await ctx.db
        .select({
          id: propertyEmails.id,
          propertyId: propertyEmails.propertyId,
          fromAddress: propertyEmails.fromAddress,
          fromName: propertyEmails.fromName,
          subject: propertyEmails.subject,
          status: propertyEmails.status,
          isRead: propertyEmails.isRead,
          threadId: propertyEmails.threadId,
          receivedAt: propertyEmails.receivedAt,
        })
        .from(propertyEmails)
        .where(and(...conditions))
        .orderBy(desc(propertyEmails.receivedAt))
        .limit(input.limit + 1);

      let nextCursor: number | undefined;
      if (emails.length > input.limit) {
        const last = emails.pop();
        nextCursor = last?.id;
      }

      return { emails, nextCursor };
    }),

  // Get single email with attachments and invoice matches
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select()
        .from(propertyEmails)
        .where(
          and(
            eq(propertyEmails.id, input.id),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );

      if (!email) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }

      const attachments = await ctx.db
        .select()
        .from(propertyEmailAttachments)
        .where(eq(propertyEmailAttachments.emailId, email.id));

      const invoiceMatches = await ctx.db
        .select()
        .from(propertyEmailInvoiceMatches)
        .where(eq(propertyEmailInvoiceMatches.emailId, email.id));

      return { email, attachments, invoiceMatches };
    }),

  // Mark emails as read
  markRead: writeProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(propertyEmails)
        .set({ isRead: true })
        .where(
          and(
            inArray(propertyEmails.id, input.ids),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );
    }),

  // Mark emails as unread
  markUnread: writeProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(propertyEmails)
        .set({ isRead: false })
        .where(
          and(
            inArray(propertyEmails.id, input.ids),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );
    }),

  // Get unread count (global or per property)
  getUnreadCount: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(propertyEmails.userId, ctx.portfolio.ownerId),
        eq(propertyEmails.isRead, false),
        eq(propertyEmails.status, "approved"),
      ];

      if (input?.propertyId) {
        conditions.push(eq(propertyEmails.propertyId, input.propertyId));
      }

      const [result] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(propertyEmails)
        .where(and(...conditions));

      return result?.count ?? 0;
    }),

  // Get forwarding address for a property
  getForwardingAddress: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const address = await ensureForwardingAddress(input.propertyId);
      return { address };
    }),

  // Regenerate forwarding address
  regenerateForwardingAddress: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const address = await regenerateForwardingAddress(input.propertyId);
      return { address };
    }),

  // Approve a quarantined email's sender
  approveSender: writeProcedure
    .input(z.object({ emailId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select()
        .from(propertyEmails)
        .where(
          and(
            eq(propertyEmails.id, input.emailId),
            eq(propertyEmails.userId, ctx.portfolio.ownerId),
            eq(propertyEmails.status, "quarantined")
          )
        );

      if (!email) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }

      // Add sender to allowlist
      await ctx.db
        .insert(propertyEmailSenders)
        .values({
          propertyId: email.propertyId,
          emailPattern: email.fromAddress,
          label: email.fromName,
        })
        .onConflictDoNothing();

      // Approve the email
      await ctx.db
        .update(propertyEmails)
        .set({ status: "approved" })
        .where(eq(propertyEmails.id, input.emailId));

      // Trigger background processing for the now-approved email
      await processEmailBackground({
        emailId: email.id,
        propertyId: email.propertyId,
        userId: email.userId,
        bodyText: email.bodyText,
        subject: email.subject,
        attachments: [], // Attachments not available after initial webhook
      });
    }),

  // Reject a quarantined email
  rejectEmail: writeProcedure
    .input(z.object({ emailId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(propertyEmails)
        .set({ status: "rejected" })
        .where(
          and(
            eq(propertyEmails.id, input.emailId),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );
    }),

  // List approved senders for a property
  listSenders: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.db
        .select()
        .from(propertyEmailSenders)
        .where(eq(propertyEmailSenders.propertyId, input.propertyId))
        .orderBy(desc(propertyEmailSenders.createdAt));
    }),

  // Add sender to allowlist
  addSender: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        emailPattern: z.string().min(1),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      await ctx.db
        .insert(propertyEmailSenders)
        .values({
          propertyId: input.propertyId,
          emailPattern: input.emailPattern.toLowerCase().trim(),
          label: input.label,
        })
        .onConflictDoNothing();
    }),

  // Remove sender from allowlist
  removeSender: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the sender belongs to a property the user owns
      const [sender] = await ctx.db
        .select({
          id: propertyEmailSenders.id,
          propertyId: propertyEmailSenders.propertyId,
        })
        .from(propertyEmailSenders)
        .where(eq(propertyEmailSenders.id, input.id));

      if (!sender) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sender not found" });
      }

      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, sender.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      await ctx.db
        .delete(propertyEmailSenders)
        .where(eq(propertyEmailSenders.id, input.id));
    }),

  // Accept invoice match
  acceptMatch: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select({
          id: propertyEmailInvoiceMatches.id,
          emailId: propertyEmailInvoiceMatches.emailId,
        })
        .from(propertyEmailInvoiceMatches)
        .where(eq(propertyEmailInvoiceMatches.id, input.id));

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      // Verify ownership via the email
      const [email] = await ctx.db
        .select({ userId: propertyEmails.userId })
        .from(propertyEmails)
        .where(eq(propertyEmails.id, match.emailId));

      if (email?.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      await ctx.db
        .update(propertyEmailInvoiceMatches)
        .set({ status: "accepted" })
        .where(eq(propertyEmailInvoiceMatches.id, input.id));
    }),

  // Reject invoice match
  rejectMatch: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select({
          id: propertyEmailInvoiceMatches.id,
          emailId: propertyEmailInvoiceMatches.emailId,
        })
        .from(propertyEmailInvoiceMatches)
        .where(eq(propertyEmailInvoiceMatches.id, input.id));

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      const [email] = await ctx.db
        .select({ userId: propertyEmails.userId })
        .from(propertyEmails)
        .where(eq(propertyEmails.id, match.emailId));

      if (email?.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      await ctx.db
        .update(propertyEmailInvoiceMatches)
        .set({ status: "rejected" })
        .where(eq(propertyEmailInvoiceMatches.id, input.id));
    }),
});
```

**Step 2: Register the router in `_app.ts`**

Add import after line 40:
```typescript
import { emailRouter } from "./email";
```

Add to router after line 81 (after `blog: blogRouter`):
```typescript
  email: emailRouter,
```

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/routers/email.ts src/server/routers/_app.ts
git commit -m "feat(email): add tRPC email router with full CRUD"
```

---

### Task 8: Global Inbox Page

**Files:**
- Create: `src/app/(dashboard)/emails/page.tsx`

**Step 1: Create the global inbox page**

```tsx
"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { Mail, MailOpen, ShieldAlert, Check, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function GlobalInboxPage() {
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: propertiesList } = trpc.property.list.useQuery();
  const { data, isLoading, refetch } = trpc.email.list.useQuery({
    propertyId: propertyFilter !== "all" ? propertyFilter : undefined,
    status:
      statusFilter !== "all"
        ? (statusFilter as "approved" | "quarantined")
        : undefined,
    limit: 50,
  });
  const markRead = trpc.email.markRead.useMutation({ onSuccess: () => refetch() });
  const approveSender = trpc.email.approveSender.useMutation({
    onSuccess: () => refetch(),
  });
  const rejectEmail = trpc.email.rejectEmail.useMutation({
    onSuccess: () => refetch(),
  });

  const propertyMap = new Map(
    (propertiesList ?? []).map((p) => [p.id, `${p.address}, ${p.suburb}`])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emails</h1>
        <p className="text-muted-foreground">
          Forwarded property emails from your approved senders
        </p>
      </div>

      <div className="flex gap-4">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {(propertiesList ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address}, {p.suburb}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="quarantined">Quarantined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading emails...
        </div>
      ) : !data?.emails.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No emails yet</p>
            <p>
              Set up email forwarding on your properties to see emails here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.emails.map((email) => (
            <Card
              key={email.id}
              className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                !email.isRead ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0"
                    onClick={() => {
                      if (!email.isRead) {
                        markRead.mutate({ ids: [email.id] });
                      }
                    }}
                  >
                    {email.isRead ? (
                      <MailOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Mail className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            !email.isRead ? "font-semibold" : ""
                          }`}
                        >
                          {email.fromName || email.fromAddress}
                        </span>
                        {email.status === "quarantined" && (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-300"
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Quarantined
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-sm truncate ${
                          !email.isRead
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {propertyMap.get(email.propertyId) ?? "Unknown property"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {email.status === "quarantined" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            approveSender.mutate({ emailId: email.id })
                          }
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            rejectEmail.mutate({ emailId: email.id })
                          }
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(email.receivedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add "Emails" to sidebar navigation**

In `src/components/layout/Sidebar.tsx`, add `Mail` to the lucide-react imports, then add to `navItems` array after the `{ href: "/export" ... }` entry:

```typescript
  { href: "/emails", label: "Emails", icon: Mail },
```

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/emails/page.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(email): add global inbox page and sidebar nav"
```

---

### Task 9: Property Email Tab

**Files:**
- Create: `src/app/(dashboard)/properties/[id]/emails/page.tsx`

**Step 1: Create the property email tab page**

```tsx
"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  MailOpen,
  ShieldAlert,
  Check,
  X,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export default function PropertyEmailsPage() {
  const params = useParams();
  const propertyId = params?.id as string;

  const [newSenderPattern, setNewSenderPattern] = useState("");
  const [newSenderLabel, setNewSenderLabel] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: emailData, isLoading, refetch } = trpc.email.list.useQuery({
    propertyId,
    limit: 50,
  });
  const { data: addressData } = trpc.email.getForwardingAddress.useQuery({
    propertyId,
  });
  const { data: senders, refetch: refetchSenders } =
    trpc.email.listSenders.useQuery({ propertyId });
  const { data: unreadCount } = trpc.email.getUnreadCount.useQuery({
    propertyId,
  });

  const markRead = trpc.email.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const approveSender = trpc.email.approveSender.useMutation({
    onSuccess: () => {
      refetch();
      refetchSenders();
    },
  });
  const rejectEmail = trpc.email.rejectEmail.useMutation({
    onSuccess: () => refetch(),
  });
  const addSender = trpc.email.addSender.useMutation({
    onSuccess: () => {
      refetchSenders();
      setNewSenderPattern("");
      setNewSenderLabel("");
    },
  });
  const removeSender = trpc.email.removeSender.useMutation({
    onSuccess: () => refetchSenders(),
  });
  const regenerateAddress = trpc.email.regenerateForwardingAddress.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCopy = () => {
    if (addressData?.address) {
      navigator.clipboard.writeText(addressData.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Forwarding Address Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Forwarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Forward property emails to this address to see them here:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                {addressData?.address ?? "Loading..."}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    confirm(
                      "Regenerate address? The old address will stop working."
                    )
                  ) {
                    regenerateAddress.mutate({ propertyId });
                  }
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Approved Senders */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Approved Senders ({senders?.length ?? 0})
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Only emails from approved senders are processed. Others are
              quarantined for your review.
            </p>

            {senders && senders.length > 0 && (
              <div className="space-y-1 mb-3">
                {senders.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm"
                  >
                    <div>
                      <span className="font-mono">{s.emailPattern}</span>
                      {s.label && (
                        <span className="text-muted-foreground ml-2">
                          ({s.label})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSender.mutate({ id: s.id })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="email@example.com or *@domain.com"
                value={newSenderPattern}
                onChange={(e) => setNewSenderPattern(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Label (optional)"
                value={newSenderLabel}
                onChange={(e) => setNewSenderLabel(e.target.value)}
                className="w-40"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!newSenderPattern.trim()}
                onClick={() =>
                  addSender.mutate({
                    propertyId,
                    emailPattern: newSenderPattern,
                    label: newSenderLabel || undefined,
                  })
                }
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Inbox
            {unreadCount ? (
              <Badge variant="secondary" className="ml-2">
                {unreadCount} unread
              </Badge>
            ) : null}
          </h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading...
          </div>
        ) : !emailData?.emails.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No emails yet. Forward emails to the address above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {emailData.emails.map((email) => (
              <Card
                key={email.id}
                className={`hover:bg-accent/50 transition-colors ${
                  !email.isRead ? "border-l-4 border-l-primary" : ""
                }`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        if (!email.isRead) {
                          markRead.mutate({ ids: [email.id] });
                        }
                      }}
                    >
                      {email.isRead ? (
                        <MailOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Mail className="w-4 h-4 text-primary shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm truncate ${
                              !email.isRead ? "font-semibold" : ""
                            }`}
                          >
                            {email.fromName || email.fromAddress}
                          </span>
                          {email.status === "quarantined" && (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-300"
                            >
                              <ShieldAlert className="w-3 h-3 mr-1" />
                              Quarantined
                            </Badge>
                          )}
                        </div>
                        <p
                          className={`text-sm truncate ${
                            !email.isRead
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {email.subject}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {email.status === "quarantined" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              approveSender.mutate({ emailId: email.id })
                            }
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              rejectEmail.mutate({ emailId: email.id })
                            }
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(email.receivedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update property detail layout breadcrumbs**

In `src/app/(dashboard)/properties/[id]/layout.tsx`, add an emails breadcrumb case after the compliance case (around line 45):

```typescript
      } else if (pathname?.includes("/emails")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Emails" });
```

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/properties/\[id\]/emails/page.tsx src/app/\(dashboard\)/properties/\[id\]/layout.tsx
git commit -m "feat(email): add property email tab with sender management"
```

---

### Task 10: Email Detail View

**Files:**
- Create: `src/app/(dashboard)/emails/[id]/page.tsx`

**Step 1: Create the email detail page**

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  ArrowLeft,
  Paperclip,
  Download,
  Check,
  X,
  ShieldAlert,
  FileText,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { useEffect } from "react";

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const emailId = parseInt(params?.id as string, 10);

  const { data, isLoading, refetch } = trpc.email.get.useQuery(
    { id: emailId },
    { enabled: !isNaN(emailId) }
  );
  const markRead = trpc.email.markRead.useMutation();
  const approveSender = trpc.email.approveSender.useMutation({
    onSuccess: () => refetch(),
  });
  const rejectEmail = trpc.email.rejectEmail.useMutation({
    onSuccess: () => refetch(),
  });
  const acceptMatch = trpc.email.acceptMatch.useMutation({
    onSuccess: () => refetch(),
  });
  const rejectMatch = trpc.email.rejectMatch.useMutation({
    onSuccess: () => refetch(),
  });

  // Mark as read on view
  useEffect(() => {
    if (data?.email && !data.email.isRead) {
      markRead.mutate({ ids: [data.email.id] });
    }
  }, [data?.email?.id, data?.email?.isRead]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Email not found
      </div>
    );
  }

  const { email, attachments, invoiceMatches } = data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Inbox
      </Button>

      {/* Quarantine banner */}
      {email.status === "quarantined" && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span className="text-sm">
                This email is from an unapproved sender:{" "}
                <strong>{email.fromAddress}</strong>
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveSender.mutate({ emailId: email.id })}
              >
                <Check className="w-3 h-3 mr-1" />
                Approve Sender
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectEmail.mutate({ emailId: email.id })}
              >
                <X className="w-3 h-3 mr-1" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email header */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-xl">{email.subject}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                From: <strong>{email.fromName || email.fromAddress}</strong>
                {email.fromName && (
                  <span className="ml-1">&lt;{email.fromAddress}&gt;</span>
                )}
              </span>
              <span>
                {format(new Date(email.receivedAt), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {email.bodyHtml ? (
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(email.bodyHtml),
              }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {email.bodyText ?? "(No content)"}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments ({attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{att.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(att.sizeBytes / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Matches */}
      {invoiceMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoice Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoiceMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                >
                  <div className="text-sm">
                    <span>Detected: ${match.amountDetected}</span>
                    <Badge
                      variant="outline"
                      className="ml-2"
                    >
                      {Math.round(match.confidence * 100)}% confidence
                    </Badge>
                    {match.status !== "pending" && (
                      <Badge
                        variant={
                          match.status === "accepted" ? "default" : "secondary"
                        }
                        className="ml-2"
                      >
                        {match.status}
                      </Badge>
                    )}
                  </div>
                  {match.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acceptMatch.mutate({ id: match.id })}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectMatch.mutate({ id: match.id })}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/emails/\[id\]/page.tsx
git commit -m "feat(email): add email detail view with attachments and invoice matches"
```

---

### Task 11: E2E Tests

**Files:**
- Create: `e2e/email.spec.ts`

**Step 1: Create E2E tests**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Email Inbox", () => {
  test("global inbox page loads", async ({ page }) => {
    await page.goto("/emails");

    await expect(page.getByRole("heading", { name: /emails/i })).toBeVisible();
    await expect(
      page.getByText(/forwarded property emails/i)
    ).toBeVisible();
  });

  test("global inbox shows empty state", async ({ page }) => {
    await page.goto("/emails");

    await expect(page.getByText(/no emails yet/i)).toBeVisible();
    await expect(
      page.getByText(/set up email forwarding/i)
    ).toBeVisible();
  });

  test("global inbox has property and status filters", async ({ page }) => {
    await page.goto("/emails");

    await expect(page.getByText(/all properties/i)).toBeVisible();
    await expect(page.getByText(/all statuses/i)).toBeVisible();
  });

  test("property email tab loads and shows forwarding address", async ({
    page,
  }) => {
    // Navigate to a property — find first property link
    await page.goto("/properties");

    const propertyLink = page.locator("a[href^='/properties/']").first();
    if (await propertyLink.isVisible()) {
      await propertyLink.click();

      // Navigate to emails tab
      await page.goto(page.url() + "/emails");

      await expect(page.getByText(/email forwarding/i)).toBeVisible();
      await expect(page.getByText(/forward property emails/i)).toBeVisible();
      await expect(page.getByText(/approved senders/i)).toBeVisible();
    }
  });

  test("sidebar shows emails link", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("link", { name: /emails/i })
    ).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add e2e/email.spec.ts
git commit -m "test(email): add E2E tests for email inbox pages"
```

---

### Task 12: Final Verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 2: Run linter**

Run: `npx next lint`
Expected: PASS (or minor warnings only)

**Step 3: Push branch**

```bash
git push -u origin feature/email-integration
```

**Step 4: Use superpowers:finishing-a-development-branch to complete the work**
