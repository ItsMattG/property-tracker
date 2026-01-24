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

export const valuationSourceEnum = pgEnum("valuation_source", [
  "manual",
  "mock",
  "corelogic",
  "proptrack",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "connected",
  "disconnected",
  "error",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "success",
  "failed",
  "pending",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "disconnected",
  "requires_reauth",
  "sync_failed",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "active",
  "dismissed",
  "resolved",
]);

export const anomalyAlertTypeEnum = pgEnum("anomaly_alert_type", [
  "missed_rent",
  "unusual_amount",
  "unexpected_expense",
  "duplicate_transaction",
]);

export const anomalySeverityEnum = pgEnum("anomaly_severity", [
  "info",
  "warning",
  "critical",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "rent_received",
  "sync_failed",
  "anomaly_critical",
  "anomaly_warning",
  "weekly_digest",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "push",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "sent",
  "failed",
  "skipped_quiet_hours",
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
  connectionStatus: connectionStatusEnum("connection_status").default("connected").notNull(),
  lastSyncStatus: syncStatusEnum("last_sync_status"),
  lastSyncError: text("last_sync_error"),
  lastManualSyncAt: timestamp("last_manual_sync_at"),
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

export const propertyValues = pgTable(
  "property_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }).notNull(),
    confidenceLow: decimal("confidence_low", { precision: 12, scale: 2 }),
    confidenceHigh: decimal("confidence_high", { precision: 12, scale: 2 }),
    apiResponseId: text("api_response_id"),
    valueDate: date("value_date").notNull(),
    source: valuationSourceEnum("source").default("manual").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_values_property_id_idx").on(table.propertyId),
    index("property_values_user_id_idx").on(table.userId),
    index("property_values_date_idx").on(table.valueDate),
  ]
);

export const connectionAlerts = pgTable(
  "connection_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
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
    userId: uuid("user_id")
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
    metadata: text("metadata"), // JSON string
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
  propertyValues: many(propertyValues),
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

export const propertyValuesRelations = relations(propertyValues, ({ one }) => ({
  property: one(properties, {
    fields: [propertyValues.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [propertyValues.userId],
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

export const forecastScenarios = pgTable(
  "forecast_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    assumptions: text("assumptions").notNull(), // JSON string
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("forecast_scenarios_user_id_idx").on(table.userId),
  ]
);

export const cashFlowForecasts = pgTable(
  "cash_flow_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    scenarioId: uuid("scenario_id")
      .references(() => forecastScenarios.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    forecastMonth: date("forecast_month").notNull(),
    projectedIncome: decimal("projected_income", { precision: 12, scale: 2 }).notNull(),
    projectedExpenses: decimal("projected_expenses", { precision: 12, scale: 2 }).notNull(),
    projectedNet: decimal("projected_net", { precision: 12, scale: 2 }).notNull(),
    breakdown: text("breakdown"), // JSON string
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cash_flow_forecasts_user_id_idx").on(table.userId),
    index("cash_flow_forecasts_scenario_id_idx").on(table.scenarioId),
    index("cash_flow_forecasts_property_id_idx").on(table.propertyId),
    index("cash_flow_forecasts_month_idx").on(table.forecastMonth),
  ]
);

export const forecastScenariosRelations = relations(forecastScenarios, ({ one, many }) => ({
  user: one(users, {
    fields: [forecastScenarios.userId],
    references: [users.id],
  }),
  forecasts: many(cashFlowForecasts),
}));

export const cashFlowForecastsRelations = relations(cashFlowForecasts, ({ one }) => ({
  user: one(users, {
    fields: [cashFlowForecasts.userId],
    references: [users.id],
  }),
  scenario: one(forecastScenarios, {
    fields: [cashFlowForecasts.scenarioId],
    references: [forecastScenarios.id],
  }),
  property: one(properties, {
    fields: [cashFlowForecasts.propertyId],
    references: [properties.id],
  }),
}));

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  rentReceived: boolean("rent_received").default(true).notNull(),
  syncFailed: boolean("sync_failed").default(true).notNull(),
  anomalyDetected: boolean("anomaly_detected").default(true).notNull(),
  weeklyDigest: boolean("weekly_digest").default(true).notNull(),
  quietHoursStart: text("quiet_hours_start").default("21:00").notNull(),
  quietHoursEnd: text("quiet_hours_end").default("08:00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    index("push_subscriptions_endpoint_idx").on(table.endpoint),
  ]
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationStatusEnum("status").notNull(),
    metadata: text("metadata"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_log_user_id_idx").on(table.userId),
    index("notification_log_sent_at_idx").on(table.sentAt),
  ]
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const notificationLogRelations = relations(
  notificationLog,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationLog.userId],
      references: [users.id],
    }),
  })
);

export const userOnboarding = pgTable("user_onboarding", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  wizardDismissedAt: timestamp("wizard_dismissed_at"),
  checklistDismissedAt: timestamp("checklist_dismissed_at"),
  completedSteps: text("completed_steps").array().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(users, {
    fields: [userOnboarding.userId],
    references: [users.id],
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
export type PropertySale = typeof propertySales.$inferSelect;
export type NewPropertySale = typeof propertySales.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type ExpectedTransaction = typeof expectedTransactions.$inferSelect;
export type NewExpectedTransaction = typeof expectedTransactions.$inferInsert;
export type PropertyValue = typeof propertyValues.$inferSelect;
export type NewPropertyValue = typeof propertyValues.$inferInsert;
export type ConnectionAlert = typeof connectionAlerts.$inferSelect;
export type NewConnectionAlert = typeof connectionAlerts.$inferInsert;
export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type NewUserOnboarding = typeof userOnboarding.$inferInsert;
export type AnomalyAlert = typeof anomalyAlerts.$inferSelect;
export type NewAnomalyAlert = typeof anomalyAlerts.$inferInsert;
export type ForecastScenario = typeof forecastScenarios.$inferSelect;
export type NewForecastScenario = typeof forecastScenarios.$inferInsert;
export type CashFlowForecast = typeof cashFlowForecasts.$inferSelect;
export type NewCashFlowForecast = typeof cashFlowForecasts.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationLogEntry = typeof notificationLog.$inferSelect;
export type NewNotificationLogEntry = typeof notificationLog.$inferInsert;
