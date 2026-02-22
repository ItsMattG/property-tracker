// Portfolio AI insights cache — stores generated insight snapshots per user
import {
  pgTable, uuid, text, timestamp, jsonb, integer, index,
  relations,
} from "./_common";
import { users } from "./auth";

export interface PortfolioInsight {
  propertyId: string | null;
  category:
    | "yield"
    | "expense"
    | "loan"
    | "concentration"
    | "compliance"
    | "growth"
    | "general";
  severity: "positive" | "info" | "warning" | "critical";
  title: string;
  body: string;
}

export const portfolioInsights = pgTable(
  "portfolio_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    insights: jsonb("insights").$type<PortfolioInsight[]>().notNull(),
    generatedAt: timestamp("generated_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    modelUsed: text("model_used").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("portfolio_insights_user_id_idx").on(table.userId)]
);

// Relations
export const portfolioInsightsRelations = relations(portfolioInsights, ({ one }) => ({
  user: one(users, {
    fields: [portfolioInsights.userId],
    references: [users.id],
  }),
}));

// Type exports
export type PortfolioInsightRow = typeof portfolioInsights.$inferSelect;
export type NewPortfolioInsightRow = typeof portfolioInsights.$inferInsert;
