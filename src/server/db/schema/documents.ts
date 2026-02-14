// Document domain: documents, extractions, property manager connections + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, boolean, index,
  relations,
} from "./_common";
import {
  documentCategoryEnum, extractionStatusEnum, documentTypeEnum,
  propertyManagerProviderEnum, pmConnectionStatusEnum, pmSyncTypeEnum, pmSyncStatusEnum,
} from "./enums";
import { users } from "./auth";
import { properties } from "./properties";
import { transactions } from "./banking";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "cascade",
    }),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: decimal("file_size", { precision: 12, scale: 0 }).notNull(),
    storagePath: text("storage_path").notNull(),
    category: documentCategoryEnum("category"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("documents_user_id_idx").on(table.userId),
    index("documents_property_id_idx").on(table.propertyId),
    index("documents_transaction_id_idx").on(table.transactionId),
  ]
);

export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    status: extractionStatusEnum("status").default("processing").notNull(),
    documentType: documentTypeEnum("document_type").default("unknown").notNull(),
    extractedData: text("extracted_data"),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    matchedPropertyId: uuid("matched_property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    propertyMatchConfidence: decimal("property_match_confidence", { precision: 3, scale: 2 }),
    draftTransactionId: uuid("draft_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("document_extractions_document_id_idx").on(table.documentId),
    index("document_extractions_status_idx").on(table.status),
  ]
);

export const propertyManagerConnections = pgTable("property_manager_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: propertyManagerProviderEnum("provider").notNull(),
  providerUserId: text("provider_user_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes").array(),
  status: pmConnectionStatusEnum("status").default("active").notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyManagerMappings = pgTable("property_manager_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .references(() => propertyManagerConnections.id, { onDelete: "cascade" })
    .notNull(),
  providerPropertyId: text("provider_property_id").notNull(),
  providerPropertyAddress: text("provider_property_address"),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  autoSync: boolean("auto_sync").default(true).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyManagerSyncLogs = pgTable("property_manager_sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .references(() => propertyManagerConnections.id, { onDelete: "cascade" })
    .notNull(),
  syncType: pmSyncTypeEnum("sync_type").notNull(),
  status: pmSyncStatusEnum("status").notNull(),
  itemsSynced: decimal("items_synced", { precision: 10, scale: 0 }).default("0"),
  transactionsCreated: decimal("transactions_created", { precision: 10, scale: 0 }).default("0"),
  errors: text("errors"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [documents.propertyId],
    references: [properties.id],
  }),
  transaction: one(transactions, {
    fields: [documents.transactionId],
    references: [transactions.id],
  }),
}));

export const documentExtractionsRelations = relations(documentExtractions, ({ one }) => ({
  document: one(documents, {
    fields: [documentExtractions.documentId],
    references: [documents.id],
  }),
  matchedProperty: one(properties, {
    fields: [documentExtractions.matchedPropertyId],
    references: [properties.id],
  }),
  draftTransaction: one(transactions, {
    fields: [documentExtractions.draftTransactionId],
    references: [transactions.id],
  }),
}));

export const propertyManagerConnectionsRelations = relations(
  propertyManagerConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [propertyManagerConnections.userId],
      references: [users.id],
    }),
    mappings: many(propertyManagerMappings),
    syncLogs: many(propertyManagerSyncLogs),
  })
);

export const propertyManagerMappingsRelations = relations(
  propertyManagerMappings,
  ({ one }) => ({
    connection: one(propertyManagerConnections, {
      fields: [propertyManagerMappings.connectionId],
      references: [propertyManagerConnections.id],
    }),
    property: one(properties, {
      fields: [propertyManagerMappings.propertyId],
      references: [properties.id],
    }),
  })
);

export const propertyManagerSyncLogsRelations = relations(
  propertyManagerSyncLogs,
  ({ one }) => ({
    connection: one(propertyManagerConnections, {
      fields: [propertyManagerSyncLogs.connectionId],
      references: [propertyManagerConnections.id],
    }),
  })
);

// Type exports
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentExtraction = typeof documentExtractions.$inferSelect;
export type NewDocumentExtraction = typeof documentExtractions.$inferInsert;
export type PropertyManagerConnection = typeof propertyManagerConnections.$inferSelect;
export type NewPropertyManagerConnection = typeof propertyManagerConnections.$inferInsert;
export type PropertyManagerMapping = typeof propertyManagerMappings.$inferSelect;
export type NewPropertyManagerMapping = typeof propertyManagerMappings.$inferInsert;
export type PropertyManagerSyncLog = typeof propertyManagerSyncLogs.$inferSelect;
export type NewPropertyManagerSyncLog = typeof propertyManagerSyncLogs.$inferInsert;
