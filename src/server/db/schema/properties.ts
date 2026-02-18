// Property core tables + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, jsonb, integer, index,
  relations, sql, vector,
} from "./_common";
import {
  stateEnum, propertyStatusEnum, propertyPurposeEnum, listingSourceTypeEnum, propertyTypeEnum,
  shareLevelEnum, valuationSourceEnum,
} from "./enums";
import { users } from "./auth";
import { entities } from "./entities";
import { bankAccounts, transactions } from "./banking";
import { loans } from "./loans";
import { propertySales } from "./tax";
import { documents } from "./documents";

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  entityId: uuid("entity_id").references(() => entities.id, {
    onDelete: "set null",
  }),
  address: text("address").notNull(),
  suburb: text("suburb").notNull(),
  state: stateEnum("state").notNull(),
  postcode: text("postcode").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).notNull(),
  purchaseDate: date("purchase_date").notNull(),
  contractDate: date("contract_date"),
  settlementDate: date("settlement_date"),
  entityName: text("entity_name").default("Personal").notNull(),
  status: propertyStatusEnum("status").default("active").notNull(),
  purpose: propertyPurposeEnum("purpose").default("investment").notNull(),
  soldAt: date("sold_at"),
  climateRisk: jsonb("climate_risk").$type<import("@/types/climate-risk").ClimateRisk>(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  forwardingAddress: text("forwarding_address").unique(),
  locked: boolean("locked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const externalListings = pgTable(
  "external_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sourceType: listingSourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    rawInput: text("raw_input"),
    extractedData: jsonb("extracted_data").notNull(),
    suburb: text("suburb").notNull(),
    state: stateEnum("state").notNull(),
    postcode: text("postcode").notNull(),
    propertyType: propertyTypeEnum("property_type").default("house").notNull(),
    price: decimal("price", { precision: 12, scale: 2 }),
    estimatedYield: decimal("estimated_yield", { precision: 5, scale: 2 }),
    estimatedGrowth: decimal("estimated_growth", { precision: 5, scale: 2 }),
    isEstimated: boolean("is_estimated").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("external_listings_user_id_idx").on(table.userId)]
);

export const propertyVectors = pgTable(
  "property_vectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    externalListingId: uuid("external_listing_id").references(
      () => externalListings.id,
      { onDelete: "cascade" }
    ),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    vector: vector("vector").notNull(),
    isShared: boolean("is_shared").default(false).notNull(),
    shareLevel: shareLevelEnum("share_level").default("none").notNull(),
    sharedAttributes: jsonb("shared_attributes").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_vectors_user_id_idx").on(table.userId),
    index("property_vectors_property_id_idx").on(table.propertyId),
    index("property_vectors_is_shared_idx").on(table.isShared),
  ]
);

export const propertyValues = pgTable(
  "property_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
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

export const suburbBenchmarks = pgTable("suburb_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  suburb: text("suburb").notNull(),
  state: text("state").notNull(),
  postcode: text("postcode").notNull(),
  propertyType: text("property_type").notNull(),
  bedrooms: integer("bedrooms"),
  medianRent: decimal("median_rent", { precision: 10, scale: 2 }),
  rentalYield: decimal("rental_yield", { precision: 5, scale: 2 }),
  vacancyRate: decimal("vacancy_rate", { precision: 5, scale: 2 }),
  daysOnMarket: integer("days_on_market"),
  medianPrice: decimal("median_price", { precision: 12, scale: 2 }),
  priceGrowth1yr: decimal("price_growth_1yr", { precision: 5, scale: 2 }),
  priceGrowth5yr: decimal("price_growth_5yr", { precision: 5, scale: 2 }),
  sampleSize: integer("sample_size"),
  dataSource: text("data_source"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const propertyPerformanceBenchmarks = pgTable("property_performance_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  yieldPercentile: integer("yield_percentile"),
  growthPercentile: integer("growth_percentile"),
  expensePercentile: integer("expense_percentile"),
  vacancyPercentile: integer("vacancy_percentile"),
  performanceScore: integer("performance_score"),
  cohortSize: integer("cohort_size"),
  cohortDescription: text("cohort_description"),
  suburbBenchmarkId: uuid("suburb_benchmark_id").references(() => suburbBenchmarks.id),
  insights: text("insights"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

// Relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, {
    fields: [properties.userId],
    references: [users.id],
  }),
  entity: one(entities, {
    fields: [properties.entityId],
    references: [entities.id],
  }),
  transactions: many(transactions),
  bankAccounts: many(bankAccounts),
  loans: many(loans),
  sales: many(propertySales),
  documents: many(documents),
  propertyValues: many(propertyValues),
  propertyVector: one(propertyVectors),
}));

export const externalListingsRelations = relations(externalListings, ({ one }) => ({
  user: one(users, {
    fields: [externalListings.userId],
    references: [users.id],
  }),
}));

export const propertyVectorsRelations = relations(propertyVectors, ({ one }) => ({
  user: one(users, {
    fields: [propertyVectors.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [propertyVectors.propertyId],
    references: [properties.id],
  }),
  externalListing: one(externalListings, {
    fields: [propertyVectors.externalListingId],
    references: [externalListings.id],
  }),
}));

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

export const suburbBenchmarksRelations = relations(suburbBenchmarks, ({ many }) => ({
  propertyBenchmarks: many(propertyPerformanceBenchmarks),
}));

export const propertyPerformanceBenchmarksRelations = relations(
  propertyPerformanceBenchmarks,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyPerformanceBenchmarks.propertyId],
      references: [properties.id],
    }),
    suburbBenchmark: one(suburbBenchmarks, {
      fields: [propertyPerformanceBenchmarks.suburbBenchmarkId],
      references: [suburbBenchmarks.id],
    }),
  })
);

// Type exports
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type PropertyValue = typeof propertyValues.$inferSelect;
export type NewPropertyValue = typeof propertyValues.$inferInsert;
export type SuburbBenchmark = typeof suburbBenchmarks.$inferSelect;
export type NewSuburbBenchmark = typeof suburbBenchmarks.$inferInsert;
export type PropertyPerformanceBenchmark = typeof propertyPerformanceBenchmarks.$inferSelect;
export type NewPropertyPerformanceBenchmark = typeof propertyPerformanceBenchmarks.$inferInsert;
export type PropertyVector = typeof propertyVectors.$inferSelect;
export type NewPropertyVector = typeof propertyVectors.$inferInsert;
export type ExternalListing = typeof externalListings.$inferSelect;
export type NewExternalListing = typeof externalListings.$inferInsert;
