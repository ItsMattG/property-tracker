// Property reminders: lease expiry, insurance renewal, compliance dates, etc.
import {
  pgTable, uuid, text, timestamp, integer, date, index, sql,
} from "./_common";
import { reminderTypeEnum } from "./enums";
import { users } from "./auth";
import { properties } from "./properties";

export const propertyReminders = pgTable(
  "property_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    reminderType: reminderTypeEnum("reminder_type").notNull(),
    title: text("title").notNull(),
    dueDate: date("due_date").notNull(),
    reminderDaysBefore: integer("reminder_days_before")
      .array()
      .notNull()
      .default(sql`'{30,7}'`),
    notes: text("notes"),
    notifiedAt: timestamp("notified_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_reminders_user_id_idx").on(table.userId),
    index("property_reminders_property_id_idx").on(table.propertyId),
    index("property_reminders_due_date_idx").on(table.dueDate),
    index("property_reminders_user_due_idx").on(table.userId, table.dueDate),
  ]
);

export type PropertyReminder = typeof propertyReminders.$inferSelect;
export type NewPropertyReminder = typeof propertyReminders.$inferInsert;
