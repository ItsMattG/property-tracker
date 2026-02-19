// Rent review domain: market rent tracking per property + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, index, uniqueIndex,
  relations,
} from "./_common";
import { users } from "./auth";
import { properties } from "./properties";

export const rentReviews = pgTable(
  "rent_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    marketRentWeekly: decimal("market_rent_weekly", {
      precision: 12,
      scale: 2,
    }).notNull(),
    dataSource: text("data_source").notNull().default("manual"),
    lastReviewedAt: timestamp("last_reviewed_at").notNull(),
    nextReviewDate: date("next_review_date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rent_reviews_property_id_idx").on(table.propertyId),
    index("rent_reviews_user_id_idx").on(table.userId),
  ]
);

export const rentReviewsRelations = relations(rentReviews, ({ one }) => ({
  user: one(users, {
    fields: [rentReviews.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [rentReviews.propertyId],
    references: [properties.id],
  }),
}));

// Type exports
export type RentReviewRow = typeof rentReviews.$inferSelect;
export type NewRentReviewRow = typeof rentReviews.$inferInsert;
