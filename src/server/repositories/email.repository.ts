import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
import {
  propertyEmails,
  propertyEmailAttachments,
  propertyEmailInvoiceMatches,
  propertyEmailSenders,
} from "../db/schema";
import type {
  PropertyEmail,
  PropertyEmailAttachment,
  PropertyEmailInvoiceMatch,
  PropertyEmailSender,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IEmailRepository,
  EmailListItem,
  UnassignedEmailItem,
} from "./interfaces/email.repository.interface";

export class EmailRepository
  extends BaseRepository
  implements IEmailRepository
{
  async findByOwner(
    userId: string,
    opts?: {
      propertyId?: string;
      status?: string;
      unreadOnly?: boolean;
      limit?: number;
      cursor?: number;
    }
  ): Promise<{ emails: EmailListItem[]; nextCursor?: number }> {
    const limit = opts?.limit ?? 50;
    const conditions = [eq(propertyEmails.userId, userId)];

    if (opts?.propertyId) {
      conditions.push(eq(propertyEmails.propertyId, opts.propertyId));
    }
    if (opts?.status) {
      conditions.push(eq(propertyEmails.status, opts.status as "approved" | "quarantined" | "rejected"));
    }
    if (opts?.unreadOnly) {
      conditions.push(eq(propertyEmails.isRead, false));
    }
    if (opts?.cursor) {
      conditions.push(sql`${propertyEmails.id} < ${opts.cursor}`);
    }

    const emails = await this.db
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
      .limit(limit + 1);

    let nextCursor: number | undefined;
    if (emails.length > limit) {
      const last = emails.pop();
      nextCursor = last?.id;
    }

    return { emails, nextCursor };
  }

  async findUnassigned(
    userId: string,
    opts?: { limit?: number; cursor?: number }
  ): Promise<{ items: UnassignedEmailItem[]; nextCursor?: number }> {
    const limit = opts?.limit ?? 50;
    const conditions = [
      eq(propertyEmails.userId, userId),
      isNull(propertyEmails.propertyId),
    ];

    if (opts?.cursor) {
      conditions.push(sql`${propertyEmails.id} < ${opts.cursor}`);
    }

    const emails = await this.db
      .select({
        id: propertyEmails.id,
        fromAddress: propertyEmails.fromAddress,
        fromName: propertyEmails.fromName,
        subject: propertyEmails.subject,
        bodyText: propertyEmails.bodyText,
        isRead: propertyEmails.isRead,
        receivedAt: propertyEmails.receivedAt,
        source: propertyEmails.source,
      })
      .from(propertyEmails)
      .where(and(...conditions))
      .orderBy(desc(propertyEmails.receivedAt))
      .limit(limit + 1);

    const hasMore = emails.length > limit;
    const items = hasMore ? emails.slice(0, -1) : emails;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor };
  }

  async findById(
    id: number,
    userId: string
  ): Promise<{
    email: PropertyEmail;
    attachments: PropertyEmailAttachment[];
    invoiceMatches: PropertyEmailInvoiceMatch[];
  } | null> {
    const [email] = await this.db
      .select()
      .from(propertyEmails)
      .where(
        and(eq(propertyEmails.id, id), eq(propertyEmails.userId, userId))
      );

    if (!email) return null;

    const [attachments, invoiceMatches] = await Promise.all([
      this.db
        .select()
        .from(propertyEmailAttachments)
        .where(eq(propertyEmailAttachments.emailId, email.id)),
      this.db
        .select()
        .from(propertyEmailInvoiceMatches)
        .where(eq(propertyEmailInvoiceMatches.emailId, email.id)),
    ]);

    return { email, attachments, invoiceMatches };
  }

  async markRead(ids: number[], userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(propertyEmails)
      .set({ isRead: true })
      .where(
        and(
          inArray(propertyEmails.id, ids),
          eq(propertyEmails.userId, userId)
        )
      );
  }

  async markUnread(ids: number[], userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(propertyEmails)
      .set({ isRead: false })
      .where(
        and(
          inArray(propertyEmails.id, ids),
          eq(propertyEmails.userId, userId)
        )
      );
  }

  async getUnreadCount(userId: string, propertyId?: string): Promise<number> {
    const conditions = [
      eq(propertyEmails.userId, userId),
      eq(propertyEmails.isRead, false),
      eq(propertyEmails.status, "approved"),
    ];

    if (propertyId) {
      conditions.push(eq(propertyEmails.propertyId, propertyId));
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(propertyEmails)
      .where(and(...conditions));

    return result?.count ?? 0;
  }

  async updateEmail(
    id: number,
    userId: string,
    data: Partial<PropertyEmail>,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(propertyEmails)
      .set(data)
      .where(
        and(eq(propertyEmails.id, id), eq(propertyEmails.userId, userId))
      );
  }

  async findSenders(propertyId: string): Promise<PropertyEmailSender[]> {
    return this.db
      .select()
      .from(propertyEmailSenders)
      .where(eq(propertyEmailSenders.propertyId, propertyId))
      .orderBy(desc(propertyEmailSenders.createdAt));
  }

  async createSender(
    data: { propertyId: string; emailPattern: string; label?: string | null },
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .insert(propertyEmailSenders)
      .values({
        propertyId: data.propertyId,
        emailPattern: data.emailPattern,
        label: data.label ?? undefined,
      })
      .onConflictDoNothing();
  }

  async deleteSender(id: number, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(propertyEmailSenders)
      .where(eq(propertyEmailSenders.id, id));
  }

  async updateInvoiceMatch(
    id: number,
    status: string,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(propertyEmailInvoiceMatches)
      .set({ status: status as "pending" | "accepted" | "rejected" })
      .where(eq(propertyEmailInvoiceMatches.id, id));
  }

  async findAttachment(
    id: number
  ): Promise<Pick<PropertyEmailAttachment, "id" | "storagePath" | "filename" | "contentType" | "emailId"> | null> {
    const [attachment] = await this.db
      .select({
        id: propertyEmailAttachments.id,
        storagePath: propertyEmailAttachments.storagePath,
        filename: propertyEmailAttachments.filename,
        contentType: propertyEmailAttachments.contentType,
        emailId: propertyEmailAttachments.emailId,
      })
      .from(propertyEmailAttachments)
      .where(eq(propertyEmailAttachments.id, id));

    return attachment ?? null;
  }

  async findSenderById(
    id: number
  ): Promise<Pick<PropertyEmailSender, "id" | "propertyId"> | null> {
    const [sender] = await this.db
      .select({
        id: propertyEmailSenders.id,
        propertyId: propertyEmailSenders.propertyId,
      })
      .from(propertyEmailSenders)
      .where(eq(propertyEmailSenders.id, id));

    return sender ?? null;
  }

  async findInvoiceMatchById(
    id: number
  ): Promise<Pick<PropertyEmailInvoiceMatch, "id" | "emailId"> | null> {
    const [match] = await this.db
      .select({
        id: propertyEmailInvoiceMatches.id,
        emailId: propertyEmailInvoiceMatches.emailId,
      })
      .from(propertyEmailInvoiceMatches)
      .where(eq(propertyEmailInvoiceMatches.id, id));

    return match ?? null;
  }
}
