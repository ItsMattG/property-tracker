// Budget domain: personal categories, personal transactions, budgets + relations + types
import {
  pgTable, uuid, text, decimal, integer, boolean, timestamp, date, index,
  relations,
} from "./_common";
import { users } from "./auth";
import { bankAccounts } from "./banking";
import { budgetGroupEnum } from "./enums";

// --- Personal Categories ---

export const personalCategories = pgTable("personal_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  group: budgetGroupEnum("group"),
  icon: text("icon").notNull().default("circle"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("personal_categories_user_id_idx").on(table.userId),
]);

export const personalCategoriesRelations = relations(personalCategories, ({ one, many }) => ({
  user: one(users, { fields: [personalCategories.userId], references: [users.id] }),
  transactions: many(personalTransactions),
  budgets: many(budgets),
}));

// --- Personal Transactions ---

export const personalTransactions = pgTable("personal_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: date("date", { mode: "date" }).notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  personalCategoryId: uuid("personal_category_id").references(() => personalCategories.id, { onDelete: "set null" }),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
  basiqTransactionId: text("basiq_transaction_id"),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  suggestedCategoryId: uuid("suggested_category_id").references(() => personalCategories.id, { onDelete: "set null" }),
  suggestionConfidence: integer("suggestion_confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("personal_transactions_user_id_idx").on(table.userId),
  index("personal_transactions_date_idx").on(table.date),
  index("personal_transactions_category_id_idx").on(table.personalCategoryId),
  index("personal_transactions_basiq_id_idx").on(table.basiqTransactionId),
]);

export const personalTransactionsRelations = relations(personalTransactions, ({ one }) => ({
  user: one(users, { fields: [personalTransactions.userId], references: [users.id] }),
  category: one(personalCategories, { fields: [personalTransactions.personalCategoryId], references: [personalCategories.id] }),
  bankAccount: one(bankAccounts, { fields: [personalTransactions.bankAccountId], references: [bankAccounts.id] }),
}));

// --- Budgets ---

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  personalCategoryId: uuid("personal_category_id").references(() => personalCategories.id, { onDelete: "cascade" }),
  monthlyAmount: decimal("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from", { mode: "date" }).notNull(),
  effectiveTo: date("effective_to", { mode: "date" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("budgets_user_id_idx").on(table.userId),
  index("budgets_category_id_idx").on(table.personalCategoryId),
]);

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(personalCategories, { fields: [budgets.personalCategoryId], references: [personalCategories.id] }),
}));

// --- Type Exports ---

export type PersonalCategory = typeof personalCategories.$inferSelect;
export type NewPersonalCategory = typeof personalCategories.$inferInsert;
export type PersonalTransaction = typeof personalTransactions.$inferSelect;
export type NewPersonalTransaction = typeof personalTransactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
