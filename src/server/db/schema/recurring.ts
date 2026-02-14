// Recurring and expected transaction tables + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, index,
  relations,
} from "./_common";
import {
  categoryEnum, transactionTypeEnum, frequencyEnum, expectedStatusEnum,
} from "./enums";
import { users } from "./auth";
import { properties } from "./properties";
import { bankAccounts, transactions } from "./banking";

export const recurringTransactions = pgTable(
  "recurring_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    category: categoryEnum("category").notNull(),
    transactionType: transactionTypeEnum("transaction_type").notNull(),
    frequency: frequencyEnum("frequency").notNull(),
    dayOfMonth: decimal("day_of_month", { precision: 2, scale: 0 }),
    dayOfWeek: decimal("day_of_week", { precision: 1, scale: 0 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    linkedBankAccountId: uuid("linked_bank_account_id").references(
      () => bankAccounts.id,
      { onDelete: "set null" }
    ),
    amountTolerance: decimal("amount_tolerance", { precision: 5, scale: 2 })
      .default("5.00")
      .notNull(),
    dateTolerance: decimal("date_tolerance", { precision: 2, scale: 0 })
      .default("3")
      .notNull(),
    alertDelayDays: decimal("alert_delay_days", { precision: 2, scale: 0 })
      .default("3")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("recurring_transactions_user_id_idx").on(table.userId),
    index("recurring_transactions_property_id_idx").on(table.propertyId),
  ]
);

export const expectedTransactions = pgTable(
  "expected_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringTransactionId: uuid("recurring_transaction_id")
      .references(() => recurringTransactions.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    expectedDate: date("expected_date").notNull(),
    expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),
    status: expectedStatusEnum("status").default("pending").notNull(),
    matchedTransactionId: uuid("matched_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("expected_transactions_user_id_idx").on(table.userId),
    index("expected_transactions_recurring_id_idx").on(table.recurringTransactionId),
    index("expected_transactions_status_idx").on(table.status),
    index("expected_transactions_date_idx").on(table.expectedDate),
  ]
);

// Relations
export const recurringTransactionsRelations = relations(
  recurringTransactions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [recurringTransactions.userId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [recurringTransactions.propertyId],
      references: [properties.id],
    }),
    linkedBankAccount: one(bankAccounts, {
      fields: [recurringTransactions.linkedBankAccountId],
      references: [bankAccounts.id],
    }),
    expectedTransactions: many(expectedTransactions),
  })
);

export const expectedTransactionsRelations = relations(
  expectedTransactions,
  ({ one }) => ({
    recurringTransaction: one(recurringTransactions, {
      fields: [expectedTransactions.recurringTransactionId],
      references: [recurringTransactions.id],
    }),
    user: one(users, {
      fields: [expectedTransactions.userId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [expectedTransactions.propertyId],
      references: [properties.id],
    }),
    matchedTransaction: one(transactions, {
      fields: [expectedTransactions.matchedTransactionId],
      references: [transactions.id],
    }),
  })
);

// Type exports
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type ExpectedTransaction = typeof expectedTransactions.$inferSelect;
export type NewExpectedTransaction = typeof expectedTransactions.$inferInsert;
