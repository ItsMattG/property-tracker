import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  date,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const stateEnum = pgEnum("state", [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
]);

export const accountTypeEnum = pgEnum("account_type", [
  "transaction",
  "savings",
  "mortgage",
  "offset",
  "credit_card",
  "line_of_credit",
]);

export const categoryEnum = pgEnum("category", [
  // Income
  "rental_income",
  "other_rental_income",
  // Expenses (Deductible)
  "advertising",
  "body_corporate",
  "borrowing_expenses",
  "cleaning",
  "council_rates",
  "gardening",
  "insurance",
  "interest_on_loans",
  "land_tax",
  "legal_expenses",
  "pest_control",
  "property_agent_fees",
  "repairs_and_maintenance",
  "capital_works_deductions",
  "stationery_and_postage",
  "travel_expenses",
  "water_charges",
  "sundry_rental_expenses",
  // Capital (CGT)
  "stamp_duty",
  "conveyancing",
  "buyers_agent_fees",
  "initial_repairs",
  // Other
  "transfer",
  "personal",
  "uncategorized",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "capital",
  "transfer",
  "personal",
]);

export const loanTypeEnum = pgEnum("loan_type", [
  "principal_and_interest",
  "interest_only",
]);

export const rateTypeEnum = pgEnum("rate_type", [
  "variable",
  "fixed",
  "split",
]);

// Tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  address: text("address").notNull(),
  suburb: text("suburb").notNull(),
  state: stateEnum("state").notNull(),
  postcode: text("postcode").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).notNull(),
  purchaseDate: date("purchase_date").notNull(),
  entityName: text("entity_name").default("Personal").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  basiqConnectionId: text("basiq_connection_id").notNull(),
  basiqAccountId: text("basiq_account_id").notNull().unique(),
  institution: text("institution").notNull(),
  accountName: text("account_name").notNull(),
  accountNumberMasked: text("account_number_masked"),
  accountType: accountTypeEnum("account_type").notNull(),
  defaultPropertyId: uuid("default_property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  isConnected: boolean("is_connected").default(true).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Add indexes for common queries
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_property_id_idx").on(table.propertyId),
    index("transactions_date_idx").on(table.date),
    index("transactions_category_idx").on(table.category),
    index("transactions_user_date_idx").on(table.userId, table.date),
  ]
);

export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  lender: text("lender").notNull(),
  accountNumberMasked: text("account_number_masked"),
  loanType: loanTypeEnum("loan_type").notNull(),
  rateType: rateTypeEnum("rate_type").notNull(),
  originalAmount: decimal("original_amount", { precision: 12, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  fixedRateExpiry: date("fixed_rate_expiry"),
  repaymentAmount: decimal("repayment_amount", { precision: 12, scale: 2 }).notNull(),
  repaymentFrequency: text("repayment_frequency").notNull(),
  offsetAccountId: uuid("offset_account_id").references(() => bankAccounts.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
  bankAccounts: many(bankAccounts),
  transactions: many(transactions),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  bankAccounts: many(bankAccounts),
  loans: many(loans),
}));

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
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
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
}));

export const loansRelations = relations(loans, ({ one }) => ({
  user: one(users, {
    fields: [loans.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [loans.propertyId],
    references: [properties.id],
  }),
  offsetAccount: one(bankAccounts, {
    fields: [loans.offsetAccountId],
    references: [bankAccounts.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
