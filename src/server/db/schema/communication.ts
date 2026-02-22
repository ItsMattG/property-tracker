// Communication domain: email connections, property emails, senders + types
import {
  pgTable, uuid, text, timestamp, decimal, boolean, integer, serial, real,
  uniqueIndex, index,
} from "./_common";
import {
  emailStatusEnum, emailProviderEnum, emailConnectionStatusEnum,
  emailSourceEnum, invoiceMatchStatusEnum,
} from "./enums";
import { users } from "./auth";
import { properties } from "./properties";
import { transactions } from "./banking";
import { documents } from "./documents";

// emailConnections defined first since propertyEmails references it
export const emailConnections = pgTable(
  "email_connections",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: emailProviderEnum("provider").notNull(),
    emailAddress: text("email_address").notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at").notNull(),
    pushSubscriptionId: text("push_subscription_id"),
    pushExpiresAt: timestamp("push_expires_at"),
    lastSyncAt: timestamp("last_sync_at"),
    lastError: text("last_error"),
    status: emailConnectionStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_connections_user_provider_email_idx").on(
      table.userId,
      table.provider,
      table.emailAddress
    ),
  ]
);

export const propertyEmails = pgTable(
  "property_emails",
  {
    id: serial("id").primaryKey(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
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
    source: emailSourceEnum("source").default("forwarded").notNull(),
    connectionId: integer("connection_id").references(
      () => emailConnections.id,
      { onDelete: "set null" }
    ),
    externalId: text("external_id"),
  },
  (table) => [
    index("property_emails_user_id_idx").on(table.userId),
    index("property_emails_user_property_idx").on(table.userId, table.propertyId),
    index("property_emails_user_read_idx").on(table.userId, table.isRead),
    index("property_emails_user_received_idx").on(table.userId, table.receivedAt),
  ]
);

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

export const emailApprovedSenders = pgTable(
  "email_approved_senders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    emailPattern: text("email_pattern").notNull(),
    label: text("label"),
    defaultPropertyId: uuid("default_property_id").references(
      () => properties.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_approved_senders_user_pattern_idx").on(
      table.userId,
      table.emailPattern
    ),
  ]
);

export const senderPropertyHistory = pgTable(
  "sender_property_history",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    senderAddress: text("sender_address").notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    confidence: real("confidence").default(1.0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sender_property_history_user_sender_idx").on(
      table.userId,
      table.senderAddress
    ),
  ]
);

// Type exports
export type EmailConnection = typeof emailConnections.$inferSelect;
export type NewEmailConnection = typeof emailConnections.$inferInsert;
export type EmailApprovedSender = typeof emailApprovedSenders.$inferSelect;
export type NewEmailApprovedSender = typeof emailApprovedSenders.$inferInsert;
export type SenderPropertyHistory = typeof senderPropertyHistory.$inferSelect;
export type NewSenderPropertyHistory = typeof senderPropertyHistory.$inferInsert;
export type PropertyEmail = typeof propertyEmails.$inferSelect;
export type NewPropertyEmail = typeof propertyEmails.$inferInsert;
export type PropertyEmailAttachment = typeof propertyEmailAttachments.$inferSelect;
export type NewPropertyEmailAttachment = typeof propertyEmailAttachments.$inferInsert;
export type PropertyEmailInvoiceMatch = typeof propertyEmailInvoiceMatches.$inferSelect;
export type NewPropertyEmailInvoiceMatch = typeof propertyEmailInvoiceMatches.$inferInsert;
export type PropertyEmailSender = typeof propertyEmailSenders.$inferSelect;
export type NewPropertyEmailSender = typeof propertyEmailSenders.$inferInsert;
