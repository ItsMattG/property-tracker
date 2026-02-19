// Tax domain: tax profiles, property sales, depreciation, categorization + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, integer, index,
  relations,
} from "./_common";
import {
  familyStatusEnum, depreciationCategoryEnum, depreciationMethodEnum,
  poolTypeEnum, taxSuggestionTypeEnum, taxSuggestionStatusEnum, categoryEnum,
} from "./enums";
import { users } from "./auth";
import { properties } from "./properties";
import { documents } from "./documents";

export const taxProfiles = pgTable(
  "tax_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: integer("financial_year").notNull(),
    grossSalary: decimal("gross_salary", { precision: 12, scale: 2 }),
    paygWithheld: decimal("payg_withheld", { precision: 12, scale: 2 }),
    otherDeductions: decimal("other_deductions", { precision: 12, scale: 2 }).default("0"),
    hasHecsDebt: boolean("has_hecs_debt").default(false).notNull(),
    hasPrivateHealth: boolean("has_private_health").default(false).notNull(),
    familyStatus: familyStatusEnum("family_status").default("single").notNull(),
    dependentChildren: integer("dependent_children").default(0).notNull(),
    partnerIncome: decimal("partner_income", { precision: 12, scale: 2 }),
    isComplete: boolean("is_complete").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_profiles_user_year_idx").on(table.userId, table.financialYear),
  ]
);

export const propertySales = pgTable("property_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
  settlementDate: date("settlement_date").notNull(),
  contractDate: date("contract_date"),
  agentCommission: decimal("agent_commission", { precision: 12, scale: 2 }).default("0").notNull(),
  legalFees: decimal("legal_fees", { precision: 12, scale: 2 }).default("0").notNull(),
  marketingCosts: decimal("marketing_costs", { precision: 12, scale: 2 }).default("0").notNull(),
  otherSellingCosts: decimal("other_selling_costs", { precision: 12, scale: 2 }).default("0").notNull(),
  costBase: decimal("cost_base", { precision: 12, scale: 2 }).notNull(),
  capitalGain: decimal("capital_gain", { precision: 12, scale: 2 }).notNull(),
  discountedGain: decimal("discounted_gain", { precision: 12, scale: 2 }),
  heldOverTwelveMonths: boolean("held_over_twelve_months").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const depreciationSchedules = pgTable(
  "depreciation_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    effectiveDate: date("effective_date").notNull(),
    totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("depreciation_schedules_property_id_idx").on(table.propertyId),
    index("depreciation_schedules_user_id_idx").on(table.userId),
  ]
);

export const depreciationAssets = pgTable(
  "depreciation_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id")
      .references(() => depreciationSchedules.id, { onDelete: "cascade" })
      .notNull(),
    assetName: text("asset_name").notNull(),
    category: depreciationCategoryEnum("category").notNull(),
    originalCost: decimal("original_cost", { precision: 12, scale: 2 }).notNull(),
    effectiveLife: decimal("effective_life", { precision: 5, scale: 2 }).notNull(),
    method: depreciationMethodEnum("method").notNull(),
    purchaseDate: date("purchase_date"),
    poolType: poolTypeEnum("pool_type").default("individual").notNull(),
    openingWrittenDownValue: decimal("opening_written_down_value", { precision: 12, scale: 2 }),
    yearlyDeduction: decimal("yearly_deduction", { precision: 12, scale: 2 }).notNull(),
    remainingValue: decimal("remaining_value", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("depreciation_assets_schedule_id_idx").on(table.scheduleId),
  ]
);

export const depreciationClaims = pgTable(
  "depreciation_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").references(() => depreciationAssets.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id")
      .references(() => depreciationSchedules.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: integer("financial_year").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  },
  (table) => [
    index("depreciation_claims_schedule_id_idx").on(table.scheduleId),
    index("depreciation_claims_fy_idx").on(table.scheduleId, table.financialYear),
  ]
);

export const capitalWorks = pgTable(
  "capital_works",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    constructionDate: date("construction_date").notNull(),
    constructionCost: decimal("construction_cost", { precision: 12, scale: 2 }).notNull(),
    claimStartDate: date("claim_start_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("capital_works_property_id_idx").on(table.propertyId),
    index("capital_works_user_id_idx").on(table.userId),
  ]
);

export const taxSuggestions = pgTable(
  "tax_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    type: taxSuggestionTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    estimatedSavings: decimal("estimated_savings", { precision: 12, scale: 2 }),
    actionUrl: text("action_url"),
    financialYear: decimal("financial_year", { precision: 4, scale: 0 }).notNull(),
    status: taxSuggestionStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_suggestions_user_id_idx").on(table.userId),
    index("tax_suggestions_status_idx").on(table.status),
    index("tax_suggestions_financial_year_idx").on(table.financialYear),
  ]
);

export const merchantCategories = pgTable(
  "merchant_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    merchantName: text("merchant_name").notNull(),
    category: categoryEnum("category").notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 2 }).default("80.00").notNull(),
    usageCount: decimal("usage_count", { precision: 8, scale: 0 }).default("1").notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("merchant_categories_user_id_idx").on(table.userId),
    index("merchant_categories_merchant_name_idx").on(table.merchantName),
  ]
);

export const categorizationExamples = pgTable(
  "categorization_examples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    category: categoryEnum("category").notNull(),
    wasCorrection: boolean("was_correction").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("categorization_examples_user_id_idx").on(table.userId),
  ]
);

// Relations
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

export const taxProfilesRelations = relations(taxProfiles, ({ one }) => ({
  user: one(users, {
    fields: [taxProfiles.userId],
    references: [users.id],
  }),
}));

export const depreciationSchedulesRelations = relations(
  depreciationSchedules,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [depreciationSchedules.propertyId],
      references: [properties.id],
    }),
    user: one(users, {
      fields: [depreciationSchedules.userId],
      references: [users.id],
    }),
    document: one(documents, {
      fields: [depreciationSchedules.documentId],
      references: [documents.id],
    }),
    assets: many(depreciationAssets),
    claims: many(depreciationClaims),
  })
);

export const depreciationAssetsRelations = relations(
  depreciationAssets,
  ({ one, many }) => ({
    schedule: one(depreciationSchedules, {
      fields: [depreciationAssets.scheduleId],
      references: [depreciationSchedules.id],
    }),
    claims: many(depreciationClaims),
  })
);

export const depreciationClaimsRelations = relations(depreciationClaims, ({ one }) => ({
  asset: one(depreciationAssets, {
    fields: [depreciationClaims.assetId],
    references: [depreciationAssets.id],
  }),
  schedule: one(depreciationSchedules, {
    fields: [depreciationClaims.scheduleId],
    references: [depreciationSchedules.id],
  }),
}));

export const capitalWorksRelations = relations(capitalWorks, ({ one }) => ({
  property: one(properties, {
    fields: [capitalWorks.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [capitalWorks.userId],
    references: [users.id],
  }),
}));

export const taxSuggestionsRelations = relations(taxSuggestions, ({ one }) => ({
  user: one(users, {
    fields: [taxSuggestions.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [taxSuggestions.propertyId],
    references: [properties.id],
  }),
}));

export const merchantCategoriesRelations = relations(merchantCategories, ({ one }) => ({
  user: one(users, {
    fields: [merchantCategories.userId],
    references: [users.id],
  }),
}));

export const categorizationExamplesRelations = relations(categorizationExamples, ({ one }) => ({
  user: one(users, {
    fields: [categorizationExamples.userId],
    references: [users.id],
  }),
}));

// Type exports
export type TaxProfile = typeof taxProfiles.$inferSelect;
export type NewTaxProfile = typeof taxProfiles.$inferInsert;
export type PropertySale = typeof propertySales.$inferSelect;
export type NewPropertySale = typeof propertySales.$inferInsert;
export type DepreciationSchedule = typeof depreciationSchedules.$inferSelect;
export type NewDepreciationSchedule = typeof depreciationSchedules.$inferInsert;
export type DepreciationAsset = typeof depreciationAssets.$inferSelect;
export type NewDepreciationAsset = typeof depreciationAssets.$inferInsert;
export type TaxSuggestion = typeof taxSuggestions.$inferSelect;
export type NewTaxSuggestion = typeof taxSuggestions.$inferInsert;
export type MerchantCategory = typeof merchantCategories.$inferSelect;
export type NewMerchantCategory = typeof merchantCategories.$inferInsert;
export type CategorizationExample = typeof categorizationExamples.$inferSelect;
export type NewCategorizationExample = typeof categorizationExamples.$inferInsert;
export type DepreciationClaim = typeof depreciationClaims.$inferSelect;
export type NewDepreciationClaim = typeof depreciationClaims.$inferInsert;
export type CapitalWork = typeof capitalWorks.$inferSelect;
export type NewCapitalWork = typeof capitalWorks.$inferInsert;
