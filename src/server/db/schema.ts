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

export const propertyStatusEnum = pgEnum("property_status", ["active", "sold"]);

export const documentCategoryEnum = pgEnum("document_category", [
  "receipt",
  "contract",
  "depreciation",
  "lease",
  "other",
]);

export const frequencyEnum = pgEnum("frequency", [
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "annually",
]);

export const expectedStatusEnum = pgEnum("expected_status", [
  "pending",
  "matched",
  "missed",
  "skipped",
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
  status: propertyStatusEnum("status").default("active").notNull(),
  soldAt: date("sold_at"),
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

export const propertySales = pgTable("property_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  // Sale details
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
  settlementDate: date("settlement_date").notNull(),
  contractDate: date("contract_date"),

  // Selling costs
  agentCommission: decimal("agent_commission", { precision: 12, scale: 2 }).default("0").notNull(),
  legalFees: decimal("legal_fees", { precision: 12, scale: 2 }).default("0").notNull(),
  marketingCosts: decimal("marketing_costs", { precision: 12, scale: 2 }).default("0").notNull(),
  otherSellingCosts: decimal("other_selling_costs", { precision: 12, scale: 2 }).default("0").notNull(),

  // Calculated CGT fields (stored for historical accuracy)
  costBase: decimal("cost_base", { precision: 12, scale: 2 }).notNull(),
  capitalGain: decimal("capital_gain", { precision: 12, scale: 2 }).notNull(),
  discountedGain: decimal("discounted_gain", { precision: 12, scale: 2 }),
  heldOverTwelveMonths: boolean("held_over_twelve_months").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Polymorphic association - linked to property OR transaction
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "cascade",
    }),

    // File metadata
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(), // "image/jpeg", "application/pdf", etc.
    fileSize: decimal("file_size", { precision: 12, scale: 0 }).notNull(), // bytes
    storagePath: text("storage_path").notNull(), // Supabase storage path

    // Optional categorization
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

export const recurringTransactions = pgTable(
  "recurring_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),

    // Template details
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    category: categoryEnum("category").notNull(),
    transactionType: transactionTypeEnum("transaction_type").notNull(),

    // Frequency
    frequency: frequencyEnum("frequency").notNull(),
    dayOfMonth: decimal("day_of_month", { precision: 2, scale: 0 }), // 1-31
    dayOfWeek: decimal("day_of_week", { precision: 1, scale: 0 }), // 0-6
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),

    // Matching config
    linkedBankAccountId: uuid("linked_bank_account_id").references(
      () => bankAccounts.id,
      { onDelete: "set null" }
    ),
    amountTolerance: decimal("amount_tolerance", { precision: 5, scale: 2 })
      .default("5.00")
      .notNull(), // percentage
    dateTolerance: decimal("date_tolerance", { precision: 2, scale: 0 })
      .default("3")
      .notNull(), // days
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
    userId: uuid("user_id")
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
  sales: many(propertySales),
  documents: many(documents),
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

export const propertySalesRelations = relations(propertySales, ({ one }) => ({
  property: one(properties, {
    fields: [propertySales.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [propertySales.userId],
    references: [users.id],
  }),
}));

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
export type PropertySale = typeof propertySales.$inferSelect;
export type NewPropertySale = typeof propertySales.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type ExpectedTransaction = typeof expectedTransactions.$inferSelect;
export type NewExpectedTransaction = typeof expectedTransactions.$inferInsert;
