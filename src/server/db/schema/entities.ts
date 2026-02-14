// Entity/Trust/SMSF domain tables + relations + types
import {
  pgTable, uuid, text, timestamp, decimal, date, boolean, jsonb, index,
  relations,
} from "./_common";
import {
  entityTypeEnum, trusteeTypeEnum, entityMemberRoleEnum,
  smsfMemberPhaseEnum, pensionFrequencyEnum,
  smsfComplianceCheckTypeEnum, smsfComplianceStatusEnum,
} from "./enums";
import { users } from "./auth";
import { properties } from "./properties";

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: entityTypeEnum("type").notNull(),
    name: text("name").notNull(),
    abn: text("abn"),
    tfn: text("tfn"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("entities_user_id_idx").on(table.userId)]
);

export const trustDetails = pgTable("trust_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .references(() => entities.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  trusteeType: trusteeTypeEnum("trustee_type").notNull(),
  trusteeName: text("trustee_name").notNull(),
  settlementDate: date("settlement_date"),
  trustDeedDate: date("trust_deed_date"),
});

export const smsfDetails = pgTable("smsf_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .references(() => entities.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  fundName: text("fund_name").notNull(),
  fundAbn: text("fund_abn"),
  establishmentDate: date("establishment_date"),
  auditorName: text("auditor_name"),
  auditorContact: text("auditor_contact"),
});

export const entityMembers = pgTable(
  "entity_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: entityMemberRoleEnum("role").notNull(),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    joinedAt: timestamp("joined_at"),
  },
  (table) => [
    index("entity_members_entity_id_idx").on(table.entityId),
    index("entity_members_user_id_idx").on(table.userId),
  ]
);

export const smsfMembers = pgTable(
  "smsf_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    memberSince: date("member_since").notNull(),
    phase: smsfMemberPhaseEnum("phase").notNull(),
    currentBalance: decimal("current_balance", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("smsf_members_entity_id_idx").on(table.entityId)]
);

export const smsfContributions = pgTable(
  "smsf_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => smsfMembers.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    concessional: decimal("concessional", { precision: 12, scale: 2 }).default("0").notNull(),
    nonConcessional: decimal("non_concessional", { precision: 12, scale: 2 }).default("0").notNull(),
    totalSuperBalance: decimal("total_super_balance", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("smsf_contributions_entity_id_idx").on(table.entityId),
    index("smsf_contributions_member_id_idx").on(table.memberId),
  ]
);

export const smsfPensions = pgTable(
  "smsf_pensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => smsfMembers.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    openingBalance: decimal("opening_balance", { precision: 14, scale: 2 }).notNull(),
    minimumRequired: decimal("minimum_required", { precision: 12, scale: 2 }).notNull(),
    amountDrawn: decimal("amount_drawn", { precision: 12, scale: 2 }).default("0").notNull(),
    frequency: pensionFrequencyEnum("frequency").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("smsf_pensions_entity_id_idx").on(table.entityId),
    index("smsf_pensions_member_id_idx").on(table.memberId),
  ]
);

export const smsfComplianceChecks = pgTable(
  "smsf_compliance_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    checkType: smsfComplianceCheckTypeEnum("check_type").notNull(),
    status: smsfComplianceStatusEnum("status").notNull(),
    details: jsonb("details"),
    checkedAt: timestamp("checked_at").defaultNow().notNull(),
  },
  (table) => [index("smsf_compliance_checks_entity_id_idx").on(table.entityId)]
);

export const smsfAuditItems = pgTable(
  "smsf_audit_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    item: text("item").notNull(),
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("smsf_audit_items_entity_id_idx").on(table.entityId)]
);

export const beneficiaries = pgTable(
  "beneficiaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    relationship: text("relationship").notNull(),
    tfn: text("tfn"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("beneficiaries_entity_id_idx").on(table.entityId)]
);

export const trustDistributions = pgTable(
  "trust_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: text("financial_year").notNull(),
    resolutionDate: date("resolution_date").notNull(),
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),
    capitalGainsComponent: decimal("capital_gains_component", { precision: 14, scale: 2 }).default("0").notNull(),
    frankingCreditsComponent: decimal("franking_credits_component", { precision: 12, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("trust_distributions_entity_id_idx").on(table.entityId)]
);

export const distributionAllocations = pgTable(
  "distribution_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    distributionId: uuid("distribution_id")
      .references(() => trustDistributions.id, { onDelete: "cascade" })
      .notNull(),
    beneficiaryId: uuid("beneficiary_id")
      .references(() => beneficiaries.id, { onDelete: "cascade" })
      .notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    capitalGains: decimal("capital_gains", { precision: 14, scale: 2 }).default("0").notNull(),
    frankingCredits: decimal("franking_credits", { precision: 12, scale: 2 }).default("0").notNull(),
  },
  (table) => [
    index("distribution_allocations_distribution_id_idx").on(table.distributionId),
    index("distribution_allocations_beneficiary_id_idx").on(table.beneficiaryId),
  ]
);

// Relations
export const entitiesRelations = relations(entities, ({ one, many }) => ({
  user: one(users, {
    fields: [entities.userId],
    references: [users.id],
  }),
  trustDetails: one(trustDetails),
  smsfDetails: one(smsfDetails),
  members: many(entityMembers),
  properties: many(properties),
}));

export const trustDetailsRelations = relations(trustDetails, ({ one }) => ({
  entity: one(entities, {
    fields: [trustDetails.entityId],
    references: [entities.id],
  }),
}));

export const smsfDetailsRelations = relations(smsfDetails, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfDetails.entityId],
    references: [entities.id],
  }),
}));

export const entityMembersRelations = relations(entityMembers, ({ one }) => ({
  entity: one(entities, {
    fields: [entityMembers.entityId],
    references: [entities.id],
  }),
  user: one(users, {
    fields: [entityMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [entityMembers.invitedBy],
    references: [users.id],
    relationName: "entityInviter",
  }),
}));

export const smsfMembersRelations = relations(smsfMembers, ({ one, many }) => ({
  entity: one(entities, {
    fields: [smsfMembers.entityId],
    references: [entities.id],
  }),
  contributions: many(smsfContributions),
  pensions: many(smsfPensions),
}));

export const smsfContributionsRelations = relations(smsfContributions, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfContributions.entityId],
    references: [entities.id],
  }),
  member: one(smsfMembers, {
    fields: [smsfContributions.memberId],
    references: [smsfMembers.id],
  }),
}));

export const smsfPensionsRelations = relations(smsfPensions, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfPensions.entityId],
    references: [entities.id],
  }),
  member: one(smsfMembers, {
    fields: [smsfPensions.memberId],
    references: [smsfMembers.id],
  }),
}));

export const smsfComplianceChecksRelations = relations(smsfComplianceChecks, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfComplianceChecks.entityId],
    references: [entities.id],
  }),
}));

export const smsfAuditItemsRelations = relations(smsfAuditItems, ({ one }) => ({
  entity: one(entities, {
    fields: [smsfAuditItems.entityId],
    references: [entities.id],
  }),
}));

export const beneficiariesRelations = relations(beneficiaries, ({ one, many }) => ({
  entity: one(entities, {
    fields: [beneficiaries.entityId],
    references: [entities.id],
  }),
  allocations: many(distributionAllocations),
}));

export const trustDistributionsRelations = relations(trustDistributions, ({ one, many }) => ({
  entity: one(entities, {
    fields: [trustDistributions.entityId],
    references: [entities.id],
  }),
  allocations: many(distributionAllocations),
}));

export const distributionAllocationsRelations = relations(distributionAllocations, ({ one }) => ({
  distribution: one(trustDistributions, {
    fields: [distributionAllocations.distributionId],
    references: [trustDistributions.id],
  }),
  beneficiary: one(beneficiaries, {
    fields: [distributionAllocations.beneficiaryId],
    references: [beneficiaries.id],
  }),
}));

// Type exports
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type TrustDetails = typeof trustDetails.$inferSelect;
export type NewTrustDetails = typeof trustDetails.$inferInsert;
export type SmsfDetails = typeof smsfDetails.$inferSelect;
export type NewSmsfDetails = typeof smsfDetails.$inferInsert;
export type EntityMember = typeof entityMembers.$inferSelect;
export type NewEntityMember = typeof entityMembers.$inferInsert;
export type SmsfMember = typeof smsfMembers.$inferSelect;
export type NewSmsfMember = typeof smsfMembers.$inferInsert;
export type SmsfContribution = typeof smsfContributions.$inferSelect;
export type NewSmsfContribution = typeof smsfContributions.$inferInsert;
export type SmsfPension = typeof smsfPensions.$inferSelect;
export type NewSmsfPension = typeof smsfPensions.$inferInsert;
export type SmsfComplianceCheck = typeof smsfComplianceChecks.$inferSelect;
export type NewSmsfComplianceCheck = typeof smsfComplianceChecks.$inferInsert;
export type SmsfAuditItem = typeof smsfAuditItems.$inferSelect;
export type NewSmsfAuditItem = typeof smsfAuditItems.$inferInsert;
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type NewBeneficiary = typeof beneficiaries.$inferInsert;
export type TrustDistribution = typeof trustDistributions.$inferSelect;
export type NewTrustDistribution = typeof trustDistributions.$inferInsert;
export type DistributionAllocation = typeof distributionAllocations.$inferSelect;
export type NewDistributionAllocation = typeof distributionAllocations.$inferInsert;
