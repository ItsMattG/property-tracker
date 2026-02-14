// Loan domain: loans, rate history, comparisons, refinance alerts, brokers, loan packs + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, jsonb, integer, index,
  relations,
} from "./_common";
import { loanTypeEnum, rateTypeEnum } from "./enums";
import { users } from "./auth";
import { properties } from "./properties";
import { bankAccounts } from "./banking";

export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
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

export const rateHistory = pgTable("rate_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  rateDate: date("rate_date").notNull(),
  cashRate: decimal("cash_rate", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loanComparisons = pgTable(
  "loan_comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    loanId: uuid("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    newRate: decimal("new_rate", { precision: 5, scale: 3 }).notNull(),
    newLender: text("new_lender"),
    switchingCosts: decimal("switching_costs", { precision: 10, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("loan_comparisons_user_id_idx").on(table.userId),
    index("loan_comparisons_loan_id_idx").on(table.loanId),
  ]
);

export const refinanceAlerts = pgTable(
  "refinance_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    enabled: boolean("enabled").default(true).notNull(),
    rateGapThreshold: decimal("rate_gap_threshold", { precision: 3, scale: 2 }).default("0.50").notNull(),
    notifyOnCashRateChange: boolean("notify_on_cash_rate_change").default(true).notNull(),
    lastAlertedAt: timestamp("last_alerted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("refinance_alerts_loan_id_idx").on(table.loanId)]
);

export const brokers = pgTable(
  "brokers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("brokers_user_id_idx").on(table.userId)]
);

export const loanPacks = pgTable(
  "loan_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    brokerId: uuid("broker_id").references(() => brokers.id, { onDelete: "set null" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }),
    accessCount: integer("access_count").default(0).notNull(),
    snapshotData: jsonb("snapshot_data").notNull(),
  },
  (table) => [
    index("loan_packs_user_id_idx").on(table.userId),
    index("loan_packs_broker_id_idx").on(table.brokerId),
    index("loan_packs_token_idx").on(table.token),
    index("loan_packs_expires_at_idx").on(table.expiresAt),
  ]
);

// Relations
export const loansRelations = relations(loans, ({ one, many }) => ({
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
  comparisons: many(loanComparisons),
  refinanceAlert: one(refinanceAlerts),
}));

export const loanComparisonsRelations = relations(loanComparisons, ({ one }) => ({
  user: one(users, {
    fields: [loanComparisons.userId],
    references: [users.id],
  }),
  loan: one(loans, {
    fields: [loanComparisons.loanId],
    references: [loans.id],
  }),
}));

export const refinanceAlertsRelations = relations(refinanceAlerts, ({ one }) => ({
  loan: one(loans, {
    fields: [refinanceAlerts.loanId],
    references: [loans.id],
  }),
}));

export const brokersRelations = relations(brokers, ({ one, many }) => ({
  user: one(users, {
    fields: [brokers.userId],
    references: [users.id],
  }),
  loanPacks: many(loanPacks),
}));

export const loanPacksRelations = relations(loanPacks, ({ one }) => ({
  user: one(users, {
    fields: [loanPacks.userId],
    references: [users.id],
  }),
  broker: one(brokers, {
    fields: [loanPacks.brokerId],
    references: [brokers.id],
  }),
}));

// Type exports
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type RateHistory = typeof rateHistory.$inferSelect;
export type NewRateHistory = typeof rateHistory.$inferInsert;
export type LoanComparison = typeof loanComparisons.$inferSelect;
export type NewLoanComparison = typeof loanComparisons.$inferInsert;
export type RefinanceAlert = typeof refinanceAlerts.$inferSelect;
export type NewRefinanceAlert = typeof refinanceAlerts.$inferInsert;
export type Broker = typeof brokers.$inferSelect;
export type NewBroker = typeof brokers.$inferInsert;
export type LoanPack = typeof loanPacks.$inferSelect;
export type NewLoanPack = typeof loanPacks.$inferInsert;
