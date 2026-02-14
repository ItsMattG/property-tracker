import type { PropertyEmail, PropertyEmailAttachment, PropertyEmailInvoiceMatch, PropertyEmailSender } from "../../db/schema";
import type { DB } from "../base";

/** Subset of email fields returned in list queries */
export type EmailListItem = Pick<PropertyEmail,
  "id" | "propertyId" | "fromAddress" | "fromName" | "subject" | "status" | "isRead" | "threadId" | "receivedAt"
>;

/** Subset of email fields returned in unassigned list queries */
export type UnassignedEmailItem = Pick<PropertyEmail,
  "id" | "fromAddress" | "fromName" | "subject" | "bodyText" | "isRead" | "receivedAt" | "source"
>;

export interface IEmailRepository {
  /** List emails for a user with optional filters and cursor pagination */
  findByOwner(
    userId: string,
    opts?: {
      propertyId?: string;
      status?: string;
      unreadOnly?: boolean;
      limit?: number;
      cursor?: number;
    }
  ): Promise<{ emails: EmailListItem[]; nextCursor?: number }>;

  /** List unassigned emails (no property) for a user */
  findUnassigned(userId: string, opts?: { limit?: number; cursor?: number }): Promise<{ items: UnassignedEmailItem[]; nextCursor?: number }>;

  /** Get a single email with attachments and invoice matches */
  findById(id: number, userId: string): Promise<{ email: PropertyEmail; attachments: PropertyEmailAttachment[]; invoiceMatches: PropertyEmailInvoiceMatch[] } | null>;

  /** Mark emails as read */
  markRead(ids: number[], userId: string, tx?: DB): Promise<void>;

  /** Mark emails as unread */
  markUnread(ids: number[], userId: string, tx?: DB): Promise<void>;

  /** Count unread approved emails for a user */
  getUnreadCount(userId: string, propertyId?: string): Promise<number>;

  /** Update an email */
  updateEmail(id: number, userId: string, data: Partial<PropertyEmail>, tx?: DB): Promise<void>;

  /** List approved senders for a property */
  findSenders(propertyId: string): Promise<PropertyEmailSender[]>;

  /** Add a sender to the allowlist */
  createSender(data: { propertyId: string; emailPattern: string; label?: string | null }, tx?: DB): Promise<void>;

  /** Remove a sender from the allowlist */
  deleteSender(id: number, tx?: DB): Promise<void>;

  /** Update an invoice match status */
  updateInvoiceMatch(id: number, status: string, tx?: DB): Promise<void>;

  /** Get an attachment by id */
  findAttachment(id: number): Promise<Pick<PropertyEmailAttachment, "id" | "storagePath" | "filename" | "contentType" | "emailId"> | null>;

  /** Find a sender by id */
  findSenderById(id: number): Promise<Pick<PropertyEmailSender, "id" | "propertyId"> | null>;

  /** Find an invoice match by id with its associated emailId */
  findInvoiceMatchById(id: number): Promise<Pick<PropertyEmailInvoiceMatch, "id" | "emailId"> | null>;
}
