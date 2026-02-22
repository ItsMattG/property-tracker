// Property groups domain: grouping, assignments + relations + types
import {
  pgTable, uuid, text, timestamp, integer, index, uniqueIndex, primaryKey,
  relations,
} from "./_common";
import { users } from "./auth";
import { properties } from "./properties";

export const propertyGroups = pgTable(
  "property_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    colour: text("colour").notNull().default("#3B82F6"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_groups_user_id_idx").on(table.userId),
    uniqueIndex("property_groups_user_name_idx").on(table.userId, table.name),
  ]
);

export const propertyGroupAssignments = pgTable(
  "property_group_assignments",
  {
    groupId: uuid("group_id")
      .references(() => propertyGroups.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.propertyId] }),
    index("property_group_assignments_property_id_idx").on(table.propertyId),
  ]
);

// Relations
export const propertyGroupsRelations = relations(propertyGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [propertyGroups.userId],
    references: [users.id],
  }),
  assignments: many(propertyGroupAssignments),
}));

export const propertyGroupAssignmentsRelations = relations(propertyGroupAssignments, ({ one }) => ({
  group: one(propertyGroups, {
    fields: [propertyGroupAssignments.groupId],
    references: [propertyGroups.id],
  }),
  property: one(properties, {
    fields: [propertyGroupAssignments.propertyId],
    references: [properties.id],
  }),
}));

// Type exports
export type PropertyGroup = typeof propertyGroups.$inferSelect;
export type NewPropertyGroup = typeof propertyGroups.$inferInsert;
export type PropertyGroupAssignment = typeof propertyGroupAssignments.$inferSelect;
export type NewPropertyGroupAssignment = typeof propertyGroupAssignments.$inferInsert;
