// Scenario domain: forecasts, what-if scenarios + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, index,
  relations,
} from "./_common";
import { scenarioStatusEnum, factorTypeEnum } from "./enums";
import { users } from "./auth";
import { properties } from "./properties";

export const forecastScenarios = pgTable(
  "forecast_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    assumptions: text("assumptions").notNull(),
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
    userId: text("user_id")
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
    breakdown: text("breakdown"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cash_flow_forecasts_user_id_idx").on(table.userId),
    index("cash_flow_forecasts_scenario_id_idx").on(table.scenarioId),
    index("cash_flow_forecasts_property_id_idx").on(table.propertyId),
    index("cash_flow_forecasts_month_idx").on(table.forecastMonth),
  ]
);

export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentScenarioId: uuid("parent_scenario_id").references((): any => scenarios.id, {
      onDelete: "set null",
    }),
    timeHorizonMonths: decimal("time_horizon_months", { precision: 3, scale: 0 })
      .default("60")
      .notNull(),
    marginalTaxRate: decimal("marginal_tax_rate", { precision: 4, scale: 2 })
      .default("0.37"),
    status: scenarioStatusEnum("status").default("draft").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("scenarios_user_id_idx").on(table.userId),
    index("scenarios_parent_id_idx").on(table.parentScenarioId),
  ]
);

export const scenarioFactors = pgTable(
  "scenario_factors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .references(() => scenarios.id, { onDelete: "cascade" })
      .notNull(),
    factorType: factorTypeEnum("factor_type").notNull(),
    config: text("config").notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    startMonth: decimal("start_month", { precision: 3, scale: 0 }).default("0").notNull(),
    durationMonths: decimal("duration_months", { precision: 3, scale: 0 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("scenario_factors_scenario_id_idx").on(table.scenarioId),
  ]
);

export const scenarioProjections = pgTable("scenario_projections", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: uuid("scenario_id")
    .references(() => scenarios.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  timeHorizonMonths: decimal("time_horizon_months", { precision: 3, scale: 0 }).notNull(),
  monthlyResults: text("monthly_results").notNull(),
  summaryMetrics: text("summary_metrics").notNull(),
  isStale: boolean("is_stale").default(false).notNull(),
});

export const scenarioSnapshots = pgTable("scenario_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: uuid("scenario_id")
    .references(() => scenarios.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  snapshotData: text("snapshot_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
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

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
  user: one(users, {
    fields: [scenarios.userId],
    references: [users.id],
  }),
  parentScenario: one(scenarios, {
    fields: [scenarios.parentScenarioId],
    references: [scenarios.id],
    relationName: "scenarioBranches",
  }),
  childScenarios: many(scenarios, { relationName: "scenarioBranches" }),
  factors: many(scenarioFactors),
  projection: one(scenarioProjections),
  snapshot: one(scenarioSnapshots),
}));

export const scenarioFactorsRelations = relations(scenarioFactors, ({ one }) => ({
  scenario: one(scenarios, {
    fields: [scenarioFactors.scenarioId],
    references: [scenarios.id],
  }),
  property: one(properties, {
    fields: [scenarioFactors.propertyId],
    references: [properties.id],
  }),
}));

export const scenarioProjectionsRelations = relations(scenarioProjections, ({ one }) => ({
  scenario: one(scenarios, {
    fields: [scenarioProjections.scenarioId],
    references: [scenarios.id],
  }),
}));

export const scenarioSnapshotsRelations = relations(scenarioSnapshots, ({ one }) => ({
  scenario: one(scenarios, {
    fields: [scenarioSnapshots.scenarioId],
    references: [scenarios.id],
  }),
}));

// Type exports
export type ForecastScenario = typeof forecastScenarios.$inferSelect;
export type NewForecastScenario = typeof forecastScenarios.$inferInsert;
export type CashFlowForecast = typeof cashFlowForecasts.$inferSelect;
export type NewCashFlowForecast = typeof cashFlowForecasts.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type ScenarioFactor = typeof scenarioFactors.$inferSelect;
export type NewScenarioFactor = typeof scenarioFactors.$inferInsert;
export type ScenarioProjection = typeof scenarioProjections.$inferSelect;
export type NewScenarioProjection = typeof scenarioProjections.$inferInsert;
export type ScenarioSnapshot = typeof scenarioSnapshots.$inferSelect;
export type NewScenarioSnapshot = typeof scenarioSnapshots.$inferInsert;
