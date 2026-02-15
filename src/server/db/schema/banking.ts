// Banking domain: bank accounts, transactions, alerts + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, index,
  relations,
} from "./_common";
import {
  accountTypeEnum, connectionStatusEnum, syncStatusEnum, categoryEnum,
  transactionTypeEnum, transactionStatusEnum, suggestionStatusEnum,
  alertTypeEnum, alertStatusEnum, anomalyAlertTypeEnum, anomalySeverityEnum,
} from "./enums";
import { users } from "./auth";
import { properties } from "./properties";
import { recurringTransactions, expectedTransactions } from "./recurring";
import { documents } from "./documents";

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  basiqConnectionId: text("basiq_connection_id").notNull(),
  basiqAccountId: text("basiq_account_id").notNull().unique(),
  institution: text("institution").notNull(),
  institutionNickname: text("institution_nickname"),
  nickname: text("nickname"),
  accountName: text("account_name").notNull(),
  accountNumberMasked: text("account_number_masked"),
  accountType: accountTypeEnum("account_type").notNull(),
  defaultPropertyId: uuid("default_property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  isConnected: boolean("is_connected").default(true).notNull(),
  connectionStatus: connectionStatusEnum("connection_status").default("connected").notNull(),
  lastSyncStatus: syncStatusEnum("last_sync_status"),
  lastSyncError: text("last_sync_error"),
  balance: decimal("balance", { precision: 12, scale: 2 }),
  lastManualSyncAt: timestamp("last_manual_sync_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "cascade",
    }),
    basiqTransactionId: text("basiq_transaction_id").unique(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    category: categoryEnum("category").default("uncategorized").notNull(),
    transactionType: transactionTypeEnum("transaction_type")
      .default("expense")
      .notNull(),
    isDeductible: boolean("is_deductible").default(false).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    notes: text("notes"),
    suggestedCategory: categoryEnum("suggested_category"),
    suggestionConfidence: decimal("suggestion_confidence", { precision: 5, scale: 2 }),
    status: transactionStatusEnum("status").default("confirmed").notNull(),
    suggestionStatus: suggestionStatusEnum("suggestion_status"),
    providerTransactionId: text("provider_transaction_id"),
    provider: text("provider"),
    claimPercent: decimal("claim_percent", { precision: 5, scale: 2 }).default("100"),
    invoiceUrl: text("invoice_url"),
    invoicePresent: boolean("invoice_present").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_property_id_idx").on(table.propertyId),
    index("transactions_date_idx").on(table.date),
    index("transactions_category_idx").on(table.category),
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_user_property_date_idx").on(table.userId, table.propertyId, table.date),
    index("transactions_provider_tx_id_idx").on(table.providerTransactionId),
  ]
);

export const transactionNotes = pgTable(
  "transaction_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .references(() => transactions.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("transaction_notes_transaction_id_idx").on(table.transactionId),
    index("transaction_notes_user_id_idx").on(table.userId),
  ]
);

export const connectionAlerts = pgTable(
  "connection_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bankAccountId: uuid("bank_account_id")
      .references(() => bankAccounts.id, { onDelete: "cascade" })
      .notNull(),
    alertType: alertTypeEnum("alert_type").notNull(),
    status: alertStatusEnum("status").default("active").notNull(),
    errorMessage: text("error_message"),
    emailSentAt: timestamp("email_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dismissedAt: timestamp("dismissed_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("connection_alerts_user_id_idx").on(table.userId),
    index("connection_alerts_bank_account_id_idx").on(table.bankAccountId),
    index("connection_alerts_status_idx").on(table.status),
  ]
);

export const anomalyAlerts = pgTable(
  "anomaly_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    alertType: anomalyAlertTypeEnum("alert_type").notNull(),
    severity: anomalySeverityEnum("severity").notNull(),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    recurringId: uuid("recurring_id").references(() => recurringTransactions.id, {
      onDelete: "set null",
    }),
    expectedTransactionId: uuid("expected_transaction_id").references(
      () => expectedTransactions.id,
      { onDelete: "set null" }
    ),
    description: text("description").notNull(),
    suggestedAction: text("suggested_action"),
    metadata: text("metadata"),
    status: alertStatusEnum("status").default("active").notNull(),
    dismissalCount: decimal("dismissal_count", { precision: 3, scale: 0 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dismissedAt: timestamp("dismissed_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("anomaly_alerts_user_id_idx").on(table.userId),
    index("anomaly_alerts_property_id_idx").on(table.propertyId),
    index("anomaly_alerts_status_idx").on(table.status),
    index("anomaly_alerts_created_at_idx").on(table.createdAt),
  ]
);

// Relations
export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [bankAccounts.userId],
    references: [users.id],
  }),
  defaultProperty: one(properties, {
    fields: [bankAccounts.defaultPropertyId],
    references: [properties.id],
  }),
  transactions: many(transactions),
  alerts: many(connectionAlerts),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [transactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  property: one(properties, {
    fields: [transactions.propertyId],
    references: [properties.id],
  }),
  documents: many(documents),
  transactionNotes: many(transactionNotes),
}));

export const transactionNotesRelations = relations(transactionNotes, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionNotes.transactionId],
    references: [transactions.id],
  }),
  user: one(users, {
    fields: [transactionNotes.userId],
    references: [users.id],
  }),
}));

export const connectionAlertsRelations = relations(connectionAlerts, ({ one }) => ({
  user: one(users, {
    fields: [connectionAlerts.userId],
    references: [users.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [connectionAlerts.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export const anomalyAlertsRelations = relations(anomalyAlerts, ({ one }) => ({
  user: one(users, {
    fields: [anomalyAlerts.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [anomalyAlerts.propertyId],
    references: [properties.id],
  }),
  transaction: one(transactions, {
    fields: [anomalyAlerts.transactionId],
    references: [transactions.id],
  }),
  recurringTransaction: one(recurringTransactions, {
    fields: [anomalyAlerts.recurringId],
    references: [recurringTransactions.id],
  }),
  expectedTransaction: one(expectedTransactions, {
    fields: [anomalyAlerts.expectedTransactionId],
    references: [expectedTransactions.id],
  }),
}));

// Type exports
export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type ConnectionAlert = typeof connectionAlerts.$inferSelect;
export type NewConnectionAlert = typeof connectionAlerts.$inferInsert;
export type TransactionNote = typeof transactionNotes.$inferSelect;
export type NewTransactionNote = typeof transactionNotes.$inferInsert;
export type AnomalyAlert = typeof anomalyAlerts.$inferSelect;
export type NewAnomalyAlert = typeof anomalyAlerts.$inferInsert;
