import type { DB } from "../base";

/**
 * Email repository interface.
 *
 * Note: propertyEmails uses numeric IDs (serial), not UUID.
 * Method signatures use number for email/attachment/sender IDs accordingly.
 */
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
  ): Promise<{ emails: unknown[]; nextCursor?: number }>;

  /** List unassigned emails (no property) for a user */
  findUnassigned(userId: string, opts?: { limit?: number; cursor?: number }): Promise<{ items: unknown[]; nextCursor?: number }>;

  /** Get a single email with attachments and invoice matches */
  findById(id: number, userId: string): Promise<{ email: unknown; attachments: unknown[]; invoiceMatches: unknown[] } | null>;

  /** Mark emails as read */
  markRead(ids: number[], userId: string, tx?: DB): Promise<void>;

  /** Mark emails as unread */
  markUnread(ids: number[], userId: string, tx?: DB): Promise<void>;

  /** Count unread approved emails for a user */
  getUnreadCount(userId: string, propertyId?: string): Promise<number>;

  /** Update an email */
  updateEmail(id: number, userId: string, data: Record<string, unknown>, tx?: DB): Promise<void>;

  /** List approved senders for a property */
  findSenders(propertyId: string): Promise<unknown[]>;

  /** Add a sender to the allowlist */
  createSender(data: { propertyId: string; emailPattern: string; label?: string }, tx?: DB): Promise<void>;

  /** Remove a sender from the allowlist */
  deleteSender(id: number, tx?: DB): Promise<void>;

  /** Update an invoice match status */
  updateInvoiceMatch(id: number, status: string, tx?: DB): Promise<void>;

  /** Get an attachment by id */
  findAttachment(id: number): Promise<unknown | null>;
}
