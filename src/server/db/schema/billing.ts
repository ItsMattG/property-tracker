// Billing domain: referrals, subscriptions, monitoring + types
import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, index,
} from "./_common";
import { referralStatusEnum, subscriptionPlanEnum, subscriptionStatusEnum } from "./enums";
import { users } from "./auth";

export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerUserId: text("referrer_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    refereeUserId: text("referee_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    referralCodeId: uuid("referral_code_id")
      .references(() => referralCodes.id, { onDelete: "cascade" })
      .notNull(),
    status: referralStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    qualifiedAt: timestamp("qualified_at"),
    rewardedAt: timestamp("rewarded_at"),
  },
  (table) => [
    index("referrals_referrer_idx").on(table.referrerUserId),
    index("referrals_referee_idx").on(table.refereeUserId),
  ]
);

export const referralCredits = pgTable("referral_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  referralId: uuid("referral_id")
    .references(() => referrals.id, { onDelete: "cascade" })
    .notNull(),
  monthsFree: integer("months_free").notNull().default(1),
  appliedAt: timestamp("applied_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  plan: subscriptionPlanEnum("plan").default("free").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cronHeartbeats = pgTable("cron_heartbeats", {
  id: uuid("id").primaryKey().defaultRandom(),
  cronName: text("cron_name").notNull().unique(),
  lastRunAt: timestamp("last_run_at").notNull(),
  status: text("status").notNull(), // "success" | "failure"
  durationMs: integer("duration_ms").notNull(),
  metadata: jsonb("metadata"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const monitorState = pgTable("monitor_state", {
  id: text("id").primaryKey(), // "uptime"
  lastStatus: text("last_status").notNull(), // "healthy" | "unhealthy"
  lastCheckedAt: timestamp("last_checked_at").notNull(),
  failingSince: timestamp("failing_since"),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
});

// Inferred types
export type ReferralCode = typeof referralCodes.$inferSelect;
export type NewReferralCode = typeof referralCodes.$inferInsert;
export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
export type ReferralCredit = typeof referralCredits.$inferSelect;
export type NewReferralCredit = typeof referralCredits.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type CronHeartbeat = typeof cronHeartbeats.$inferSelect;
export type NewCronHeartbeat = typeof cronHeartbeats.$inferInsert;
export type MonitorState = typeof monitorState.$inferSelect;
export type NewMonitorState = typeof monitorState.$inferInsert;
