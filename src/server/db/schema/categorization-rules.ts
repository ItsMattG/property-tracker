// Categorization rules: user-configurable rules that match before AI categorization
import {
  pgTable, uuid, text, integer, timestamp, boolean, index,
  relations,
} from "./_common";
import { categoryEnum } from "./enums";
import { users } from "./auth";
import { properties } from "./properties";

export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    merchantPattern: text("merchant_pattern"),
    descriptionPattern: text("description_pattern"),
    matchType: text("match_type").notNull().default("contains"), // "contains" | "equals" | "starts_with" | "regex"
    amountMin: integer("amount_min"),
    amountMax: integer("amount_max"),
    targetCategory: categoryEnum("target_category").notNull(),
    targetPropertyId: uuid("target_property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    matchCount: integer("match_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("categorization_rules_user_id_idx").on(table.userId),
    index("categorization_rules_active_priority_idx").on(table.userId, table.isActive, table.priority),
  ]
);

export const categorizationRulesRelations = relations(categorizationRules, ({ one }) => ({
  user: one(users, {
    fields: [categorizationRules.userId],
    references: [users.id],
  }),
  targetProperty: one(properties, {
    fields: [categorizationRules.targetPropertyId],
    references: [properties.id],
  }),
}));

export type CategorizationRule = typeof categorizationRules.$inferSelect;
export type NewCategorizationRule = typeof categorizationRules.$inferInsert;
