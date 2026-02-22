// Portfolio domain: sharing, team, compliance, onboarding, milestones + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, jsonb, integer, index,
  relations,
} from "./_common";
import {
  shareLevelEnum, portfolioMemberRoleEnum, inviteStatusEnum,
  auditActionEnum, privacyModeEnum, milestoneTypeEnum,
} from "./enums";
import { users } from "./auth";
import { properties } from "./properties";
import { documents } from "./documents";

export const sharingPreferences = pgTable("sharing_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  defaultShareLevel: shareLevelEnum("default_share_level").default("none").notNull(),
  defaultSharedAttributes: jsonb("default_shared_attributes")
    .$type<string[]>()
    .default(["suburb", "state", "propertyType", "priceBracket", "yield"])
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userOnboarding = pgTable("user_onboarding", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  wizardDismissedAt: timestamp("wizard_dismissed_at"),
  checklistDismissedAt: timestamp("checklist_dismissed_at"),
  completedSteps: text("completed_steps").array().default([]).notNull(),
  completedTours: text("completed_tours").array().default([]).notNull(),
  toursDisabled: boolean("tours_disabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portfolioMembers = pgTable(
  "portfolio_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: portfolioMemberRoleEnum("role").notNull(),
    invitedBy: text("invited_by")
      .references(() => users.id, { onDelete: "set null" }),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    joinedAt: timestamp("joined_at"),
  },
  (table) => [
    index("portfolio_members_owner_id_idx").on(table.ownerId),
    index("portfolio_members_user_id_idx").on(table.userId),
  ]
);

export const portfolioInvites = pgTable(
  "portfolio_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    role: portfolioMemberRoleEnum("role").notNull(),
    status: inviteStatusEnum("status").default("pending").notNull(),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("portfolio_invites_owner_id_idx").on(table.ownerId),
    index("portfolio_invites_token_idx").on(table.token),
    index("portfolio_invites_email_idx").on(table.email),
  ]
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    actorId: text("actor_id")
      .references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    targetEmail: text("target_email"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_owner_id_idx").on(table.ownerId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
);

export const portfolioShares = pgTable("portfolio_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  title: text("title").notNull(),
  privacyMode: privacyModeEnum("privacy_mode").notNull().default("full"),
  snapshotData: jsonb("snapshot_data").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
});

export const complianceRecords = pgTable(
  "compliance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    requirementId: text("requirement_id").notNull(),
    completedAt: date("completed_at").notNull(),
    nextDueAt: date("next_due_at").notNull(),
    notes: text("notes"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("compliance_records_property_id_idx").on(table.propertyId),
    index("compliance_records_user_id_idx").on(table.userId),
    index("compliance_records_next_due_idx").on(table.nextDueAt),
  ]
);

export const equityMilestones = pgTable(
  "equity_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    milestoneType: milestoneTypeEnum("milestone_type").notNull(),
    milestoneValue: decimal("milestone_value", { precision: 12, scale: 2 }).notNull(),
    equityAtAchievement: decimal("equity_at_achievement", { precision: 12, scale: 2 }).notNull(),
    lvrAtAchievement: decimal("lvr_at_achievement", { precision: 5, scale: 2 }).notNull(),
    achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  },
  (table) => [
    index("equity_milestones_property_id_idx").on(table.propertyId),
    index("equity_milestones_user_id_idx").on(table.userId),
  ]
);

export const milestonePreferences = pgTable("milestone_preferences", {
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .primaryKey(),
  lvrThresholds: jsonb("lvr_thresholds").$type<number[]>().default([80, 60, 40, 20]).notNull(),
  equityThresholds: jsonb("equity_thresholds").$type<number[]>().default([100000, 250000, 500000, 1000000]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  /** IDs of achievement milestones the user has already been celebrated for */
  achievedMilestones: jsonb("achieved_milestones").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyMilestoneOverrides = pgTable("property_milestone_overrides", {
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull()
    .primaryKey(),
  lvrThresholds: jsonb("lvr_thresholds").$type<number[] | null>(),
  equityThresholds: jsonb("equity_thresholds").$type<number[] | null>(),
  enabled: boolean("enabled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export interface AccountantPackSections {
  incomeExpenses: boolean;
  depreciation: boolean;
  capitalGains: boolean;
  taxPosition: boolean;
  portfolioOverview: boolean;
  loanDetails: boolean;
}

export const accountantPackSends = pgTable(
  "accountant_pack_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    accountantEmail: text("accountant_email").notNull(),
    accountantName: text("accountant_name"),
    financialYear: integer("financial_year").notNull(),
    sections: jsonb("sections").$type<AccountantPackSections>().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("accountant_pack_sends_user_id_idx").on(table.userId),
  ]
);

// Relations
export const sharingPreferencesRelations = relations(sharingPreferences, ({ one }) => ({
  user: one(users, {
    fields: [sharingPreferences.userId],
    references: [users.id],
  }),
}));

export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(users, {
    fields: [userOnboarding.userId],
    references: [users.id],
  }),
}));

export const portfolioMembersRelations = relations(portfolioMembers, ({ one }) => ({
  owner: one(users, {
    fields: [portfolioMembers.ownerId],
    references: [users.id],
    relationName: "portfolioOwner",
  }),
  user: one(users, {
    fields: [portfolioMembers.userId],
    references: [users.id],
    relationName: "portfolioMember",
  }),
  inviter: one(users, {
    fields: [portfolioMembers.invitedBy],
    references: [users.id],
    relationName: "portfolioInviter",
  }),
}));

export const portfolioInvitesRelations = relations(portfolioInvites, ({ one }) => ({
  owner: one(users, {
    fields: [portfolioInvites.ownerId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [portfolioInvites.invitedBy],
    references: [users.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  owner: one(users, {
    fields: [auditLog.ownerId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [auditLog.actorId],
    references: [users.id],
  }),
}));

export const portfolioSharesRelations = relations(portfolioShares, ({ one }) => ({
  user: one(users, {
    fields: [portfolioShares.userId],
    references: [users.id],
  }),
}));

export const complianceRecordsRelations = relations(complianceRecords, ({ one }) => ({
  property: one(properties, {
    fields: [complianceRecords.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [complianceRecords.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [complianceRecords.documentId],
    references: [documents.id],
  }),
}));

export const milestonePreferencesRelations = relations(milestonePreferences, ({ one }) => ({
  user: one(users, {
    fields: [milestonePreferences.userId],
    references: [users.id],
  }),
}));

export const propertyMilestoneOverridesRelations = relations(propertyMilestoneOverrides, ({ one }) => ({
  property: one(properties, {
    fields: [propertyMilestoneOverrides.propertyId],
    references: [properties.id],
  }),
}));

export const accountantPackSendsRelations = relations(accountantPackSends, ({ one }) => ({
  user: one(users, {
    fields: [accountantPackSends.userId],
    references: [users.id],
  }),
}));

// Type exports
export type PortfolioMember = typeof portfolioMembers.$inferSelect;
export type NewPortfolioMember = typeof portfolioMembers.$inferInsert;
export type PortfolioInvite = typeof portfolioInvites.$inferSelect;
export type NewPortfolioInvite = typeof portfolioInvites.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type PortfolioShare = typeof portfolioShares.$inferSelect;
export type NewPortfolioShare = typeof portfolioShares.$inferInsert;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type NewComplianceRecord = typeof complianceRecords.$inferInsert;
export type EquityMilestone = typeof equityMilestones.$inferSelect;
export type NewEquityMilestone = typeof equityMilestones.$inferInsert;
export type MilestonePreferences = typeof milestonePreferences.$inferSelect;
export type NewMilestonePreferences = typeof milestonePreferences.$inferInsert;
export type PropertyMilestoneOverride = typeof propertyMilestoneOverrides.$inferSelect;
export type NewPropertyMilestoneOverride = typeof propertyMilestoneOverrides.$inferInsert;
export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type NewUserOnboarding = typeof userOnboarding.$inferInsert;
export type SharingPreference = typeof sharingPreferences.$inferSelect;
export type NewSharingPreference = typeof sharingPreferences.$inferInsert;
export type AccountantPackSend = typeof accountantPackSends.$inferSelect;
export type NewAccountantPackSend = typeof accountantPackSends.$inferInsert;
