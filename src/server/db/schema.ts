import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  date,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
  integer,
  varchar,
  customType,
  serial,
  real,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Custom type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(5)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,0.3,0.4,0.5]" format
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => parseFloat(v));
  },
});

// Enums
export const stateEnum = pgEnum("state", [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
]);

export const accountTypeEnum = pgEnum("account_type", [
  "transaction",
  "savings",
  "mortgage",
  "offset",
  "credit_card",
  "line_of_credit",
]);

export const categoryEnum = pgEnum("category", [
  // Income
  "rental_income",
  "other_rental_income",
  // Expenses (Deductible)
  "advertising",
  "body_corporate",
  "borrowing_expenses",
  "cleaning",
  "council_rates",
  "gardening",
  "insurance",
  "interest_on_loans",
  "land_tax",
  "legal_expenses",
  "pest_control",
  "property_agent_fees",
  "repairs_and_maintenance",
  "capital_works_deductions",
  "stationery_and_postage",
  "travel_expenses",
  "water_charges",
  "sundry_rental_expenses",
  // Capital (CGT)
  "stamp_duty",
  "conveyancing",
  "buyers_agent_fees",
  "initial_repairs",
  // Other
  "transfer",
  "personal",
  "uncategorized",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "capital",
  "transfer",
  "personal",
]);

export const loanTypeEnum = pgEnum("loan_type", [
  "principal_and_interest",
  "interest_only",
]);

export const rateTypeEnum = pgEnum("rate_type", [
  "variable",
  "fixed",
  "split",
]);

export const propertyStatusEnum = pgEnum("property_status", ["active", "sold"]);

export const documentCategoryEnum = pgEnum("document_category", [
  "receipt",
  "contract",
  "depreciation",
  "lease",
  "other",
]);

export const frequencyEnum = pgEnum("frequency", [
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "annually",
]);

export const expectedStatusEnum = pgEnum("expected_status", [
  "pending",
  "matched",
  "missed",
  "skipped",
]);

export const valuationSourceEnum = pgEnum("valuation_source", [
  "manual",
  "mock",
  "corelogic",
  "proptrack",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "connected",
  "disconnected",
  "error",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "success",
  "failed",
  "pending",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "disconnected",
  "requires_reauth",
  "sync_failed",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "active",
  "dismissed",
  "resolved",
]);

export const anomalyAlertTypeEnum = pgEnum("anomaly_alert_type", [
  "missed_rent",
  "unusual_amount",
  "unexpected_expense",
  "duplicate_transaction",
]);

export const anomalySeverityEnum = pgEnum("anomaly_severity", [
  "info",
  "warning",
  "critical",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "rent_received",
  "sync_failed",
  "anomaly_critical",
  "anomaly_warning",
  "weekly_digest",
  "eofy_suggestions",
  "refinance_opportunity",
  "cash_rate_changed",
  "compliance_reminder",
  "equity_milestone",
  "task_reminder",
  "task_assigned",
  "task_completed",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "push",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "sent",
  "failed",
  "skipped_quiet_hours",
]);

export const portfolioMemberRoleEnum = pgEnum("portfolio_member_role", [
  "owner",
  "partner",
  "accountant",
  "advisor",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "member_invited",
  "member_removed",
  "role_changed",
  "invite_accepted",
  "invite_declined",
  "bank_connected",
  "bank_disconnected",
]);

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const depreciationCategoryEnum = pgEnum("depreciation_category", [
  "plant_equipment",
  "capital_works",
]);

export const depreciationMethodEnum = pgEnum("depreciation_method", [
  "diminishing_value",
  "prime_cost",
]);

export const taxSuggestionTypeEnum = pgEnum("tax_suggestion_type", [
  "prepay_interest",
  "schedule_repairs",
  "claim_depreciation",
  "missed_deduction",
]);

export const taxSuggestionStatusEnum = pgEnum("tax_suggestion_status", [
  "active",
  "dismissed",
  "actioned",
]);

export const loanPurposeEnum = pgEnum("loan_purpose", [
  "owner_occupied",
  "investor",
]);

export const extractionStatusEnum = pgEnum("extraction_status", [
  "processing",
  "completed",
  "failed",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "receipt",
  "rate_notice",
  "insurance",
  "invoice",
  "unknown",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "confirmed",
  "pending_review",
]);

export const propertyManagerProviderEnum = pgEnum("property_manager_provider", [
  "propertyme",
  "different",
]);

export const pmConnectionStatusEnum = pgEnum("pm_connection_status", [
  "active",
  "expired",
  "revoked",
]);

export const pmSyncTypeEnum = pgEnum("pm_sync_type", [
  "full",
  "incremental",
  "manual",
]);

export const pmSyncStatusEnum = pgEnum("pm_sync_status", [
  "running",
  "completed",
  "failed",
]);

export const scenarioStatusEnum = pgEnum("scenario_status", [
  "draft",
  "saved",
]);

export const factorTypeEnum = pgEnum("factor_type", [
  "interest_rate",
  "vacancy",
  "sell_property",
  "buy_property",
  "rent_change",
  "expense_change",
]);

export const privacyModeEnum = pgEnum("privacy_mode", [
  "full",
  "summary",
  "redacted",
]);

export const milestoneTypeEnum = pgEnum("milestone_type", [
  "lvr",
  "equity_amount",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "personal",
  "trust",
  "smsf",
  "company",
]);

export const trusteeTypeEnum = pgEnum("trustee_type", [
  "individual",
  "corporate",
]);

export const entityMemberRoleEnum = pgEnum("entity_member_role", [
  "owner",
  "admin",
  "member",
  "accountant",
  "advisor",
]);

export const smsfMemberPhaseEnum = pgEnum("smsf_member_phase", [
  "accumulation",
  "pension",
]);

export const pensionFrequencyEnum = pgEnum("pension_frequency", [
  "monthly",
  "quarterly",
  "annual",
]);

export const smsfComplianceCheckTypeEnum = pgEnum("smsf_compliance_check_type", [
  "in_house_asset",
  "related_party",
  "arm_length",
]);

export const smsfComplianceStatusEnum = pgEnum("smsf_compliance_status", [
  "compliant",
  "warning",
  "breach",
]);

export const familyStatusEnum = pgEnum("family_status", [
  "single",
  "couple",
  "family",
]);

export const shareLevelEnum = pgEnum("share_level", [
  "none",
  "anonymous",
  "pseudonymous",
  "controlled",
]);

export const listingSourceTypeEnum = pgEnum("listing_source_type", [
  "url",
  "text",
  "manual",
]);

export const propertyTypeEnum = pgEnum("property_type", [
  "house",
  "townhouse",
  "unit",
]);

export const featureRequestStatusEnum = pgEnum("feature_request_status", [
  "open",
  "planned",
  "in_progress",
  "shipped",
  "rejected",
]);

export const featureRequestCategoryEnum = pgEnum("feature_request_category", [
  "feature",
  "improvement",
  "integration",
  "other",
]);

export const bugReportStatusEnum = pgEnum("bug_report_status", [
  "new",
  "investigating",
  "fixed",
  "wont_fix",
]);

export const bugReportSeverityEnum = pgEnum("bug_report_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const changelogCategoryEnum = pgEnum("changelog_category", [
  "feature",
  "improvement",
  "fix",
]);

export const blogCategoryEnum = pgEnum("blog_category", [
  "fundamentals",
  "strategy",
  "finance",
  "tax",
  "advanced",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "quarantined",
  "approved",
  "rejected",
]);

export const invoiceMatchStatusEnum = pgEnum("invoice_match_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "urgent",
  "high",
  "normal",
  "low",
]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "bug",
  "question",
  "feature_request",
  "account_issue",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
]);

export const ticketUrgencyEnum = pgEnum("ticket_urgency", [
  "low",
  "medium",
  "high",
  "critical",
]);

// Tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  mobilePasswordHash: text("mobile_password_hash"),
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialPlan: varchar("trial_plan", { length: 20 }).default("pro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
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
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: entityMemberRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, {
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

// SMSF Compliance Tables
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

// Trust Compliance Tables
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

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
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
  entityName: text("entity_name").default("Personal").notNull(),
  status: propertyStatusEnum("status").default("active").notNull(),
  soldAt: date("sold_at"),
  climateRisk: jsonb("climate_risk").$type<import("@/types/climate-risk").ClimateRisk>(),
  forwardingAddress: text("forwarding_address").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const externalListings = pgTable(
  "external_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
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
    userId: uuid("user_id")
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

export const sharingPreferences = pgTable("sharing_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
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

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  basiqConnectionId: text("basiq_connection_id").notNull(),
  basiqAccountId: text("basiq_account_id").notNull().unique(),
  institution: text("institution").notNull(),
  accountName: text("account_name").notNull(),
  accountNumberMasked: text("account_number_masked"),
  accountType: accountTypeEnum("account_type").notNull(),
  defaultPropertyId: uuid("default_property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  isConnected: boolean("is_connected").default(true).notNull(),
  connectionStatus: connectionStatusEnum("connection_status").default("connected").notNull(),
  lastSyncStatus: syncStatusEnum("last_sync_status"),
  lastSyncError: text("last_sync_error"),
  lastManualSyncAt: timestamp("last_manual_sync_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "cascade",
    }),
    basiqTransactionId: text("basiq_transaction_id").unique(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    category: categoryEnum("category").default("uncategorized").notNull(),
    transactionType: transactionTypeEnum("transaction_type")
      .default("expense")
      .notNull(),
    isDeductible: boolean("is_deductible").default(false).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    notes: text("notes"),
    suggestedCategory: categoryEnum("suggested_category"),
    suggestionConfidence: decimal("suggestion_confidence", { precision: 5, scale: 2 }),
    status: transactionStatusEnum("status").default("confirmed").notNull(),
    suggestionStatus: suggestionStatusEnum("suggestion_status"),
    providerTransactionId: text("provider_transaction_id"),
    provider: text("provider"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Add indexes for common queries
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_property_id_idx").on(table.propertyId),
    index("transactions_date_idx").on(table.date),
    index("transactions_category_idx").on(table.category),
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_user_property_date_idx").on(table.userId, table.propertyId, table.date),
    index("transactions_provider_tx_id_idx").on(table.providerTransactionId),
  ]
);

export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  lender: text("lender").notNull(),
  accountNumberMasked: text("account_number_masked"),
  loanType: loanTypeEnum("loan_type").notNull(),
  rateType: rateTypeEnum("rate_type").notNull(),
  originalAmount: decimal("original_amount", { precision: 12, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  fixedRateExpiry: date("fixed_rate_expiry"),
  repaymentAmount: decimal("repayment_amount", { precision: 12, scale: 2 }).notNull(),
  repaymentFrequency: text("repayment_frequency").notNull(),
  offsetAccountId: uuid("offset_account_id").references(() => bankAccounts.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertySales = pgTable("property_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  // Sale details
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
  settlementDate: date("settlement_date").notNull(),
  contractDate: date("contract_date"),

  // Selling costs
  agentCommission: decimal("agent_commission", { precision: 12, scale: 2 }).default("0").notNull(),
  legalFees: decimal("legal_fees", { precision: 12, scale: 2 }).default("0").notNull(),
  marketingCosts: decimal("marketing_costs", { precision: 12, scale: 2 }).default("0").notNull(),
  otherSellingCosts: decimal("other_selling_costs", { precision: 12, scale: 2 }).default("0").notNull(),

  // Calculated CGT fields (stored for historical accuracy)
  costBase: decimal("cost_base", { precision: 12, scale: 2 }).notNull(),
  capitalGain: decimal("capital_gain", { precision: 12, scale: 2 }).notNull(),
  discountedGain: decimal("discounted_gain", { precision: 12, scale: 2 }),
  heldOverTwelveMonths: boolean("held_over_twelve_months").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Polymorphic association - linked to property OR transaction
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "cascade",
    }),

    // File metadata
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(), // "image/jpeg", "application/pdf", etc.
    fileSize: decimal("file_size", { precision: 12, scale: 0 }).notNull(), // bytes
    storagePath: text("storage_path").notNull(), // Supabase storage path

    // Optional categorization
    category: documentCategoryEnum("category"),
    description: text("description"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("documents_user_id_idx").on(table.userId),
    index("documents_property_id_idx").on(table.propertyId),
    index("documents_transaction_id_idx").on(table.transactionId),
  ]
);

export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    status: extractionStatusEnum("status").default("processing").notNull(),
    documentType: documentTypeEnum("document_type").default("unknown").notNull(),
    extractedData: text("extracted_data"), // JSON string
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    matchedPropertyId: uuid("matched_property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    propertyMatchConfidence: decimal("property_match_confidence", { precision: 3, scale: 2 }),
    draftTransactionId: uuid("draft_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("document_extractions_document_id_idx").on(table.documentId),
    index("document_extractions_status_idx").on(table.status),
  ]
);

export const propertyManagerConnections = pgTable("property_manager_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: propertyManagerProviderEnum("provider").notNull(),
  providerUserId: text("provider_user_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes").array(),
  status: pmConnectionStatusEnum("status").default("active").notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyManagerMappings = pgTable("property_manager_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .references(() => propertyManagerConnections.id, { onDelete: "cascade" })
    .notNull(),
  providerPropertyId: text("provider_property_id").notNull(),
  providerPropertyAddress: text("provider_property_address"),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  autoSync: boolean("auto_sync").default(true).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyManagerSyncLogs = pgTable("property_manager_sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .references(() => propertyManagerConnections.id, { onDelete: "cascade" })
    .notNull(),
  syncType: pmSyncTypeEnum("sync_type").notNull(),
  status: pmSyncStatusEnum("status").notNull(),
  itemsSynced: decimal("items_synced", { precision: 10, scale: 0 }).default("0"),
  transactionsCreated: decimal("transactions_created", { precision: 10, scale: 0 }).default("0"),
  errors: text("errors"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const propertyEmails = pgTable("property_emails", {
  id: serial("id").primaryKey(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  fromAddress: text("from_address").notNull(),
  fromName: text("from_name"),
  subject: text("subject").notNull(),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  messageId: text("message_id").unique(),
  inReplyTo: text("in_reply_to"),
  threadId: text("thread_id"),
  status: emailStatusEnum("status").default("approved").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  receivedAt: timestamp("received_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyEmailAttachments = pgTable("property_email_attachments", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id")
    .references(() => propertyEmails.id, { onDelete: "cascade" })
    .notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyEmailInvoiceMatches = pgTable("property_email_invoice_matches", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id")
    .references(() => propertyEmails.id, { onDelete: "cascade" })
    .notNull(),
  transactionId: uuid("transaction_id")
    .references(() => transactions.id, { onDelete: "cascade" })
    .notNull(),
  confidence: real("confidence").notNull(),
  amountDetected: decimal("amount_detected", { precision: 12, scale: 2 }).notNull(),
  status: invoiceMatchStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyEmailSenders = pgTable(
  "property_email_senders",
  {
    id: serial("id").primaryKey(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    emailPattern: text("email_pattern").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("property_email_senders_property_pattern_idx").on(
      table.propertyId,
      table.emailPattern
    ),
  ]
);

export const recurringTransactions = pgTable(
  "recurring_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),

    // Template details
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    category: categoryEnum("category").notNull(),
    transactionType: transactionTypeEnum("transaction_type").notNull(),

    // Frequency
    frequency: frequencyEnum("frequency").notNull(),
    dayOfMonth: decimal("day_of_month", { precision: 2, scale: 0 }), // 1-31
    dayOfWeek: decimal("day_of_week", { precision: 1, scale: 0 }), // 0-6
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),

    // Matching config
    linkedBankAccountId: uuid("linked_bank_account_id").references(
      () => bankAccounts.id,
      { onDelete: "set null" }
    ),
    amountTolerance: decimal("amount_tolerance", { precision: 5, scale: 2 })
      .default("5.00")
      .notNull(), // percentage
    dateTolerance: decimal("date_tolerance", { precision: 2, scale: 0 })
      .default("3")
      .notNull(), // days
    alertDelayDays: decimal("alert_delay_days", { precision: 2, scale: 0 })
      .default("3")
      .notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("recurring_transactions_user_id_idx").on(table.userId),
    index("recurring_transactions_property_id_idx").on(table.propertyId),
  ]
);

export const expectedTransactions = pgTable(
  "expected_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringTransactionId: uuid("recurring_transaction_id")
      .references(() => recurringTransactions.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),

    expectedDate: date("expected_date").notNull(),
    expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),

    status: expectedStatusEnum("status").default("pending").notNull(),
    matchedTransactionId: uuid("matched_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" }
    ),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("expected_transactions_user_id_idx").on(table.userId),
    index("expected_transactions_recurring_id_idx").on(table.recurringTransactionId),
    index("expected_transactions_status_idx").on(table.status),
    index("expected_transactions_date_idx").on(table.expectedDate),
  ]
);

export const propertyValues = pgTable(
  "property_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
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

export const connectionAlerts = pgTable(
  "connection_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bankAccountId: uuid("bank_account_id")
      .references(() => bankAccounts.id, { onDelete: "cascade" })
      .notNull(),
    alertType: alertTypeEnum("alert_type").notNull(),
    status: alertStatusEnum("status").default("active").notNull(),
    errorMessage: text("error_message"),
    emailSentAt: timestamp("email_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dismissedAt: timestamp("dismissed_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("connection_alerts_user_id_idx").on(table.userId),
    index("connection_alerts_bank_account_id_idx").on(table.bankAccountId),
    index("connection_alerts_status_idx").on(table.status),
  ]
);

export const anomalyAlerts = pgTable(
  "anomaly_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    alertType: anomalyAlertTypeEnum("alert_type").notNull(),
    severity: anomalySeverityEnum("severity").notNull(),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    recurringId: uuid("recurring_id").references(() => recurringTransactions.id, {
      onDelete: "set null",
    }),
    expectedTransactionId: uuid("expected_transaction_id").references(
      () => expectedTransactions.id,
      { onDelete: "set null" }
    ),
    description: text("description").notNull(),
    suggestedAction: text("suggested_action"),
    metadata: text("metadata"), // JSON string
    status: alertStatusEnum("status").default("active").notNull(),
    dismissalCount: decimal("dismissal_count", { precision: 3, scale: 0 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dismissedAt: timestamp("dismissed_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("anomaly_alerts_user_id_idx").on(table.userId),
    index("anomaly_alerts_property_id_idx").on(table.propertyId),
    index("anomaly_alerts_status_idx").on(table.status),
    index("anomaly_alerts_created_at_idx").on(table.createdAt),
  ]
);

export const suburbBenchmarks = pgTable("suburb_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  suburb: text("suburb").notNull(),
  state: text("state").notNull(),
  postcode: text("postcode").notNull(),
  propertyType: text("property_type").notNull(), // 'house', 'unit', 'townhouse'
  bedrooms: integer("bedrooms"), // null = all bedrooms aggregate

  // Rental metrics
  medianRent: decimal("median_rent", { precision: 10, scale: 2 }),
  rentalYield: decimal("rental_yield", { precision: 5, scale: 2 }),
  vacancyRate: decimal("vacancy_rate", { precision: 5, scale: 2 }),
  daysOnMarket: integer("days_on_market"),

  // Sales metrics
  medianPrice: decimal("median_price", { precision: 12, scale: 2 }),
  priceGrowth1yr: decimal("price_growth_1yr", { precision: 5, scale: 2 }),
  priceGrowth5yr: decimal("price_growth_5yr", { precision: 5, scale: 2 }),

  // Metadata
  sampleSize: integer("sample_size"),
  dataSource: text("data_source"), // 'domain', 'corelogic', 'mock'
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

  // Percentile rankings (0-100)
  yieldPercentile: integer("yield_percentile"),
  growthPercentile: integer("growth_percentile"),
  expensePercentile: integer("expense_percentile"),
  vacancyPercentile: integer("vacancy_percentile"),

  // Overall score
  performanceScore: integer("performance_score"), // 0-100

  // Comparison context
  cohortSize: integer("cohort_size"),
  cohortDescription: text("cohort_description"), // "3-bed houses in Richmond VIC"
  suburbBenchmarkId: uuid("suburb_benchmark_id").references(() => suburbBenchmarks.id),

  // Insights
  insights: text("insights"), // JSON string of {type, message, severity}[]

  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

export const taxProfiles = pgTable(
  "tax_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    financialYear: integer("financial_year").notNull(),

    // Income
    grossSalary: decimal("gross_salary", { precision: 12, scale: 2 }),
    paygWithheld: decimal("payg_withheld", { precision: 12, scale: 2 }),
    otherDeductions: decimal("other_deductions", { precision: 12, scale: 2 }).default("0"),

    // HECS/HELP
    hasHecsDebt: boolean("has_hecs_debt").default(false).notNull(),

    // Medicare Levy Surcharge
    hasPrivateHealth: boolean("has_private_health").default(false).notNull(),
    familyStatus: familyStatusEnum("family_status").default("single").notNull(),
    dependentChildren: integer("dependent_children").default(0).notNull(),
    partnerIncome: decimal("partner_income", { precision: 12, scale: 2 }),

    // Metadata
    isComplete: boolean("is_complete").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tax_profiles_user_year_idx").on(table.userId, table.financialYear),
  ]
);

// Feedback System Tables
export const featureRequests = pgTable(
  "feature_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    category: featureRequestCategoryEnum("category").notNull(),
    status: featureRequestStatusEnum("status").default("open").notNull(),
    voteCount: integer("vote_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_requests_user_id_idx").on(table.userId),
    index("feature_requests_status_idx").on(table.status),
    index("feature_requests_vote_count_idx").on(table.voteCount),
  ]
);

export const featureVotes = pgTable(
  "feature_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    featureId: uuid("feature_id")
      .references(() => featureRequests.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feature_votes_user_feature_idx").on(table.userId, table.featureId),
  ]
);

export const featureComments = pgTable(
  "feature_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureId: uuid("feature_id")
      .references(() => featureRequests.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_comments_feature_id_idx").on(table.featureId),
  ]
);

export const bugReports = pgTable(
  "bug_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    stepsToReproduce: text("steps_to_reproduce"),
    severity: bugReportSeverityEnum("severity").notNull(),
    browserInfo: jsonb("browser_info"),
    currentPage: varchar("current_page", { length: 500 }),
    status: bugReportStatusEnum("status").default("new").notNull(),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bug_reports_user_id_idx").on(table.userId),
    index("bug_reports_status_idx").on(table.status),
    index("bug_reports_severity_idx").on(table.severity),
  ]
);

// Changelog entries (synced from markdown files)
export const changelogEntries = pgTable("changelog_entries", {
  id: text("id").primaryKey(), // slug from filename
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: changelogCategoryEnum("category").notNull(),
  publishedAt: date("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track when users last viewed changelog
export const userChangelogViews = pgTable("user_changelog_views", {
  userId: text("user_id").primaryKey(),
  lastViewedAt: timestamp("last_viewed_at").notNull(),
});

// Blog posts (synced from markdown files)
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: blogCategoryEnum("category").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'`),
  author: text("author").notNull(),
  publishedAt: date("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
  bankAccounts: many(bankAccounts),
  transactions: many(transactions),
  entities: many(entities),
  chatConversations: many(chatConversations),
}));

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

// SMSF Compliance Relations
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

// Trust Compliance Relations
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

export const sharingPreferencesRelations = relations(sharingPreferences, ({ one }) => ({
  user: one(users, {
    fields: [sharingPreferences.userId],
    references: [users.id],
  }),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [bankAccounts.userId],
    references: [users.id],
  }),
  defaultProperty: one(properties, {
    fields: [bankAccounts.defaultPropertyId],
    references: [properties.id],
  }),
  transactions: many(transactions),
  alerts: many(connectionAlerts),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [transactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  property: one(properties, {
    fields: [transactions.propertyId],
    references: [properties.id],
  }),
  documents: many(documents),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  user: one(users, {
    fields: [loans.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [loans.propertyId],
    references: [properties.id],
  }),
  offsetAccount: one(bankAccounts, {
    fields: [loans.offsetAccountId],
    references: [bankAccounts.id],
  }),
  comparisons: many(loanComparisons),
  refinanceAlert: one(refinanceAlerts),
}));

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

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [documents.propertyId],
    references: [properties.id],
  }),
  transaction: one(transactions, {
    fields: [documents.transactionId],
    references: [transactions.id],
  }),
}));

export const documentExtractionsRelations = relations(documentExtractions, ({ one }) => ({
  document: one(documents, {
    fields: [documentExtractions.documentId],
    references: [documents.id],
  }),
  matchedProperty: one(properties, {
    fields: [documentExtractions.matchedPropertyId],
    references: [properties.id],
  }),
  draftTransaction: one(transactions, {
    fields: [documentExtractions.draftTransactionId],
    references: [transactions.id],
  }),
}));

export const propertyManagerConnectionsRelations = relations(
  propertyManagerConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [propertyManagerConnections.userId],
      references: [users.id],
    }),
    mappings: many(propertyManagerMappings),
    syncLogs: many(propertyManagerSyncLogs),
  })
);

export const propertyManagerMappingsRelations = relations(
  propertyManagerMappings,
  ({ one }) => ({
    connection: one(propertyManagerConnections, {
      fields: [propertyManagerMappings.connectionId],
      references: [propertyManagerConnections.id],
    }),
    property: one(properties, {
      fields: [propertyManagerMappings.propertyId],
      references: [properties.id],
    }),
  })
);

export const propertyManagerSyncLogsRelations = relations(
  propertyManagerSyncLogs,
  ({ one }) => ({
    connection: one(propertyManagerConnections, {
      fields: [propertyManagerSyncLogs.connectionId],
      references: [propertyManagerConnections.id],
    }),
  })
);

export const recurringTransactionsRelations = relations(
  recurringTransactions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [recurringTransactions.userId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [recurringTransactions.propertyId],
      references: [properties.id],
    }),
    linkedBankAccount: one(bankAccounts, {
      fields: [recurringTransactions.linkedBankAccountId],
      references: [bankAccounts.id],
    }),
    expectedTransactions: many(expectedTransactions),
  })
);

export const expectedTransactionsRelations = relations(
  expectedTransactions,
  ({ one }) => ({
    recurringTransaction: one(recurringTransactions, {
      fields: [expectedTransactions.recurringTransactionId],
      references: [recurringTransactions.id],
    }),
    user: one(users, {
      fields: [expectedTransactions.userId],
      references: [users.id],
    }),
    property: one(properties, {
      fields: [expectedTransactions.propertyId],
      references: [properties.id],
    }),
    matchedTransaction: one(transactions, {
      fields: [expectedTransactions.matchedTransactionId],
      references: [transactions.id],
    }),
  })
);

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

export const connectionAlertsRelations = relations(connectionAlerts, ({ one }) => ({
  user: one(users, {
    fields: [connectionAlerts.userId],
    references: [users.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [connectionAlerts.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export const anomalyAlertsRelations = relations(anomalyAlerts, ({ one }) => ({
  user: one(users, {
    fields: [anomalyAlerts.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [anomalyAlerts.propertyId],
    references: [properties.id],
  }),
  transaction: one(transactions, {
    fields: [anomalyAlerts.transactionId],
    references: [transactions.id],
  }),
  recurringTransaction: one(recurringTransactions, {
    fields: [anomalyAlerts.recurringId],
    references: [recurringTransactions.id],
  }),
  expectedTransaction: one(expectedTransactions, {
    fields: [anomalyAlerts.expectedTransactionId],
    references: [expectedTransactions.id],
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

export const forecastScenarios = pgTable(
  "forecast_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    assumptions: text("assumptions").notNull(), // JSON string
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
    userId: uuid("user_id")
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
    breakdown: text("breakdown"), // JSON string
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cash_flow_forecasts_user_id_idx").on(table.userId),
    index("cash_flow_forecasts_scenario_id_idx").on(table.scenarioId),
    index("cash_flow_forecasts_property_id_idx").on(table.propertyId),
    index("cash_flow_forecasts_month_idx").on(table.forecastMonth),
  ]
);

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

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  rentReceived: boolean("rent_received").default(true).notNull(),
  syncFailed: boolean("sync_failed").default(true).notNull(),
  anomalyDetected: boolean("anomaly_detected").default(true).notNull(),
  weeklyDigest: boolean("weekly_digest").default(true).notNull(),
  complianceReminders: boolean("compliance_reminders").default(true).notNull(),
  taskReminders: boolean("task_reminders").default(true).notNull(),
  quietHoursStart: text("quiet_hours_start").default("21:00").notNull(),
  quietHoursEnd: text("quiet_hours_end").default("08:00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    index("push_subscriptions_endpoint_idx").on(table.endpoint),
  ]
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationStatusEnum("status").notNull(),
    metadata: text("metadata"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_log_user_id_idx").on(table.userId),
    index("notification_log_sent_at_idx").on(table.sentAt),
  ]
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const notificationLogRelations = relations(
  notificationLog,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationLog.userId],
      references: [users.id],
    }),
  })
);

// Push tokens for mobile notifications (React Native)
export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform", { enum: ["ios", "android"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

export const userOnboarding = pgTable("user_onboarding", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
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

export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(users, {
    fields: [userOnboarding.userId],
    references: [users.id],
  }),
}));

export const portfolioMembers = pgTable(
  "portfolio_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: portfolioMemberRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by")
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
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    role: portfolioMemberRoleEnum("role").notNull(),
    status: inviteStatusEnum("status").default("pending").notNull(),
    token: text("token").notNull().unique(),
    invitedBy: uuid("invited_by")
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
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    actorId: uuid("actor_id")
      .references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    targetEmail: text("target_email"),
    metadata: text("metadata"), // JSON string
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_owner_id_idx").on(table.ownerId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
);

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

export const merchantCategories = pgTable(
  "merchant_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
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
    userId: uuid("user_id")
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

export const depreciationSchedules = pgTable(
  "depreciation_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .references(() => properties.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
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
    yearlyDeduction: decimal("yearly_deduction", { precision: 12, scale: 2 }).notNull(),
    remainingValue: decimal("remaining_value", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("depreciation_assets_schedule_id_idx").on(table.scheduleId),
  ]
);

export const taxSuggestions = pgTable(
  "tax_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
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

// Loan Comparison Tables
export const rateHistory = pgTable("rate_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  rateDate: date("rate_date").notNull(),
  cashRate: decimal("cash_rate", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loanComparisons = pgTable(
  "loan_comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    loanId: uuid("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    newRate: decimal("new_rate", { precision: 5, scale: 3 }).notNull(),
    newLender: text("new_lender"),
    switchingCosts: decimal("switching_costs", { precision: 10, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("loan_comparisons_user_id_idx").on(table.userId),
    index("loan_comparisons_loan_id_idx").on(table.loanId),
  ]
);

export const refinanceAlerts = pgTable(
  "refinance_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id")
      .references(() => loans.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    enabled: boolean("enabled").default(true).notNull(),
    rateGapThreshold: decimal("rate_gap_threshold", { precision: 3, scale: 2 }).default("0.50").notNull(),
    notifyOnCashRateChange: boolean("notify_on_cash_rate_change").default(true).notNull(),
    lastAlertedAt: timestamp("last_alerted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("refinance_alerts_loan_id_idx").on(table.loanId)]
);

// Scenario Simulator Tables
export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
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
      .default("0.37"), // Default 37% bracket
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
    config: text("config").notNull(), // JSON string
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
  monthlyResults: text("monthly_results").notNull(), // JSON array
  summaryMetrics: text("summary_metrics").notNull(), // JSON object
  isStale: boolean("is_stale").default(false).notNull(),
});

export const scenarioSnapshots = pgTable("scenario_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: uuid("scenario_id")
    .references(() => scenarios.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  snapshotData: text("snapshot_data").notNull(), // JSON object
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
    userId: uuid("user_id")
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
    userId: uuid("user_id")
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
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .primaryKey(),
  lvrThresholds: jsonb("lvr_thresholds").$type<number[]>().default([80, 60, 40, 20]).notNull(),
  equityThresholds: jsonb("equity_thresholds").$type<number[]>().default([100000, 250000, 500000, 1000000]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
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

export const brokers = pgTable(
  "brokers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("brokers_user_id_idx").on(table.userId)]
);

export const loanPacks = pgTable(
  "loan_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    brokerId: uuid("broker_id").references(() => brokers.id, { onDelete: "set null" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }),
    accessCount: integer("access_count").default(0).notNull(),
    snapshotData: jsonb("snapshot_data").notNull(),
  },
  (table) => [
    index("loan_packs_user_id_idx").on(table.userId),
    index("loan_packs_broker_id_idx").on(table.brokerId),
    index("loan_packs_token_idx").on(table.token),
    index("loan_packs_expires_at_idx").on(table.expiresAt),
  ]
);

// Scenario Relations
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

export const brokersRelations = relations(brokers, ({ one, many }) => ({
  user: one(users, {
    fields: [brokers.userId],
    references: [users.id],
  }),
  loanPacks: many(loanPacks),
}));

export const loanPacksRelations = relations(loanPacks, ({ one }) => ({
  user: one(users, {
    fields: [loanPacks.userId],
    references: [users.id],
  }),
  broker: one(brokers, {
    fields: [loanPacks.brokerId],
    references: [brokers.id],
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
  })
);

export const depreciationAssetsRelations = relations(
  depreciationAssets,
  ({ one }) => ({
    schedule: one(depreciationSchedules, {
      fields: [depreciationAssets.scheduleId],
      references: [depreciationSchedules.id],
    }),
  })
);

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

export const loanComparisonsRelations = relations(loanComparisons, ({ one }) => ({
  user: one(users, {
    fields: [loanComparisons.userId],
    references: [users.id],
  }),
  loan: one(loans, {
    fields: [loanComparisons.loanId],
    references: [loans.id],
  }),
}));

export const refinanceAlertsRelations = relations(refinanceAlerts, ({ one }) => ({
  loan: one(loans, {
    fields: [refinanceAlerts.loanId],
    references: [loans.id],
  }),
}));

export const taxProfilesRelations = relations(taxProfiles, ({ one }) => ({
  user: one(users, {
    fields: [taxProfiles.userId],
    references: [users.id],
  }),
}));

// Feedback System Relations
export const featureRequestsRelations = relations(featureRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [featureRequests.userId],
    references: [users.id],
  }),
  votes: many(featureVotes),
  comments: many(featureComments),
}));

export const featureVotesRelations = relations(featureVotes, ({ one }) => ({
  user: one(users, {
    fields: [featureVotes.userId],
    references: [users.id],
  }),
  feature: one(featureRequests, {
    fields: [featureVotes.featureId],
    references: [featureRequests.id],
  }),
}));

export const featureCommentsRelations = relations(featureComments, ({ one }) => ({
  user: one(users, {
    fields: [featureComments.userId],
    references: [users.id],
  }),
  feature: one(featureRequests, {
    fields: [featureComments.featureId],
    references: [featureRequests.id],
  }),
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
}));

// Tasks
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    entityId: uuid("entity_id").references(() => entities.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").default("todo").notNull(),
    priority: taskPriorityEnum("priority").default("normal").notNull(),
    dueDate: date("due_date"),
    reminderOffset: integer("reminder_offset"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_assignee_id_idx").on(table.assigneeId),
    index("tasks_property_id_idx").on(table.propertyId),
    index("tasks_entity_id_idx").on(table.entityId),
    index("tasks_due_date_idx").on(table.dueDate),
    index("tasks_status_idx").on(table.status),
  ]
);

// Chat AI Assistant
export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_conversations_user_id_idx").on(table.userId),
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => chatConversations.id, { onDelete: "cascade" })
      .notNull(),
    role: chatMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls"),
    toolResults: jsonb("tool_results"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_conversation_id_idx").on(table.conversationId),
  ]
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "taskAssignee",
  }),
  property: one(properties, {
    fields: [tasks.propertyId],
    references: [properties.id],
  }),
  entity: one(entities, {
    fields: [tasks.entityId],
    references: [entities.id],
  }),
}));

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

// --- Support Tickets ---

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    ticketNumber: serial("ticket_number").notNull(),
    category: ticketCategoryEnum("category").notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    description: text("description").notNull(),
    urgency: ticketUrgencyEnum("urgency").notNull(),
    status: ticketStatusEnum("status").default("open").notNull(),
    browserInfo: jsonb("browser_info"),
    currentPage: varchar("current_page", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_urgency_idx").on(table.urgency),
    index("support_tickets_category_idx").on(table.category),
  ]
);

export const ticketNotes = pgTable(
  "ticket_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .references(() => supportTickets.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ticket_notes_ticket_id_idx").on(table.ticketId),
  ]
);

export const supportTicketsRelations = relations(supportTickets, ({ many }) => ({
  notes: many(ticketNotes),
}));

export const ticketNotesRelations = relations(ticketNotes, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketNotes.ticketId],
    references: [supportTickets.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type TrustDetails = typeof trustDetails.$inferSelect;
export type NewTrustDetails = typeof trustDetails.$inferInsert;
export type SmsfDetails = typeof smsfDetails.$inferSelect;
export type NewSmsfDetails = typeof smsfDetails.$inferInsert;
export type EntityMember = typeof entityMembers.$inferSelect;
export type NewEntityMember = typeof entityMembers.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type PropertySale = typeof propertySales.$inferSelect;
export type NewPropertySale = typeof propertySales.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type ExpectedTransaction = typeof expectedTransactions.$inferSelect;
export type NewExpectedTransaction = typeof expectedTransactions.$inferInsert;
export type PropertyValue = typeof propertyValues.$inferSelect;
export type NewPropertyValue = typeof propertyValues.$inferInsert;
export type ConnectionAlert = typeof connectionAlerts.$inferSelect;
export type NewConnectionAlert = typeof connectionAlerts.$inferInsert;
export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type NewUserOnboarding = typeof userOnboarding.$inferInsert;
export type AnomalyAlert = typeof anomalyAlerts.$inferSelect;
export type NewAnomalyAlert = typeof anomalyAlerts.$inferInsert;
export type ForecastScenario = typeof forecastScenarios.$inferSelect;
export type NewForecastScenario = typeof forecastScenarios.$inferInsert;
export type CashFlowForecast = typeof cashFlowForecasts.$inferSelect;
export type NewCashFlowForecast = typeof cashFlowForecasts.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationLogEntry = typeof notificationLog.$inferSelect;
export type NewNotificationLogEntry = typeof notificationLog.$inferInsert;
export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
export type PortfolioMember = typeof portfolioMembers.$inferSelect;
export type NewPortfolioMember = typeof portfolioMembers.$inferInsert;
export type PortfolioInvite = typeof portfolioInvites.$inferSelect;
export type NewPortfolioInvite = typeof portfolioInvites.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type MerchantCategory = typeof merchantCategories.$inferSelect;
export type NewMerchantCategory = typeof merchantCategories.$inferInsert;
export type CategorizationExample = typeof categorizationExamples.$inferSelect;
export type NewCategorizationExample = typeof categorizationExamples.$inferInsert;
export type DepreciationSchedule = typeof depreciationSchedules.$inferSelect;
export type NewDepreciationSchedule = typeof depreciationSchedules.$inferInsert;
export type DepreciationAsset = typeof depreciationAssets.$inferSelect;
export type NewDepreciationAsset = typeof depreciationAssets.$inferInsert;
export type TaxSuggestion = typeof taxSuggestions.$inferSelect;
export type NewTaxSuggestion = typeof taxSuggestions.$inferInsert;
export type RateHistory = typeof rateHistory.$inferSelect;
export type NewRateHistory = typeof rateHistory.$inferInsert;
export type LoanComparison = typeof loanComparisons.$inferSelect;
export type NewLoanComparison = typeof loanComparisons.$inferInsert;
export type RefinanceAlert = typeof refinanceAlerts.$inferSelect;
export type NewRefinanceAlert = typeof refinanceAlerts.$inferInsert;
export type DocumentExtraction = typeof documentExtractions.$inferSelect;
export type NewDocumentExtraction = typeof documentExtractions.$inferInsert;
export type PropertyManagerConnection = typeof propertyManagerConnections.$inferSelect;
export type NewPropertyManagerConnection = typeof propertyManagerConnections.$inferInsert;
export type PropertyManagerMapping = typeof propertyManagerMappings.$inferSelect;
export type NewPropertyManagerMapping = typeof propertyManagerMappings.$inferInsert;
export type PropertyManagerSyncLog = typeof propertyManagerSyncLogs.$inferSelect;
export type NewPropertyManagerSyncLog = typeof propertyManagerSyncLogs.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type ScenarioFactor = typeof scenarioFactors.$inferSelect;
export type NewScenarioFactor = typeof scenarioFactors.$inferInsert;
export type ScenarioProjection = typeof scenarioProjections.$inferSelect;
export type NewScenarioProjection = typeof scenarioProjections.$inferInsert;
export type ScenarioSnapshot = typeof scenarioSnapshots.$inferSelect;
export type NewScenarioSnapshot = typeof scenarioSnapshots.$inferInsert;
export type PortfolioShare = typeof portfolioShares.$inferSelect;
export type NewPortfolioShare = typeof portfolioShares.$inferInsert;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type NewComplianceRecord = typeof complianceRecords.$inferInsert;
export type EquityMilestone = typeof equityMilestones.$inferSelect;
export type NewEquityMilestone = typeof equityMilestones.$inferInsert;
export type Broker = typeof brokers.$inferSelect;
export type NewBroker = typeof brokers.$inferInsert;
export type LoanPack = typeof loanPacks.$inferSelect;
export type NewLoanPack = typeof loanPacks.$inferInsert;
// SMSF Compliance Types
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
// Trust Compliance Types
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type NewBeneficiary = typeof beneficiaries.$inferInsert;
export type TrustDistribution = typeof trustDistributions.$inferSelect;
export type NewTrustDistribution = typeof trustDistributions.$inferInsert;
export type DistributionAllocation = typeof distributionAllocations.$inferSelect;
export type NewDistributionAllocation = typeof distributionAllocations.$inferInsert;
// Performance Benchmark Types
export type SuburbBenchmark = typeof suburbBenchmarks.$inferSelect;
export type NewSuburbBenchmark = typeof suburbBenchmarks.$inferInsert;
export type PropertyPerformanceBenchmark = typeof propertyPerformanceBenchmarks.$inferSelect;
export type NewPropertyPerformanceBenchmark = typeof propertyPerformanceBenchmarks.$inferInsert;
// Milestone Preferences Types
export type MilestonePreferences = typeof milestonePreferences.$inferSelect;
export type NewMilestonePreferences = typeof milestonePreferences.$inferInsert;
export type PropertyMilestoneOverride = typeof propertyMilestoneOverrides.$inferSelect;
export type NewPropertyMilestoneOverride = typeof propertyMilestoneOverrides.$inferInsert;
// Tax Profiles Types
export type TaxProfile = typeof taxProfiles.$inferSelect;
export type NewTaxProfile = typeof taxProfiles.$inferInsert;
// Feedback System Types
export type FeatureRequest = typeof featureRequests.$inferSelect;
export type NewFeatureRequest = typeof featureRequests.$inferInsert;
export type FeatureVote = typeof featureVotes.$inferSelect;
export type NewFeatureVote = typeof featureVotes.$inferInsert;
export type FeatureComment = typeof featureComments.$inferSelect;
export type NewFeatureComment = typeof featureComments.$inferInsert;
export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;
// Changelog Types
export type ChangelogEntry = typeof changelogEntries.$inferSelect;
export type NewChangelogEntry = typeof changelogEntries.$inferInsert;
export type UserChangelogView = typeof userChangelogViews.$inferSelect;
export type NewUserChangelogView = typeof userChangelogViews.$inferInsert;
// Blog Types
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
// Email Types
export type PropertyEmail = typeof propertyEmails.$inferSelect;
export type NewPropertyEmail = typeof propertyEmails.$inferInsert;
export type PropertyEmailAttachment = typeof propertyEmailAttachments.$inferSelect;
export type NewPropertyEmailAttachment = typeof propertyEmailAttachments.$inferInsert;
export type PropertyEmailInvoiceMatch = typeof propertyEmailInvoiceMatches.$inferSelect;
export type NewPropertyEmailInvoiceMatch = typeof propertyEmailInvoiceMatches.$inferInsert;
export type PropertyEmailSender = typeof propertyEmailSenders.$inferSelect;
export type NewPropertyEmailSender = typeof propertyEmailSenders.$inferInsert;
// Task Types
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
// Support Ticket Types
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type TicketNote = typeof ticketNotes.$inferSelect;
export type NewTicketNote = typeof ticketNotes.$inferInsert;

// Referral system
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "qualified",
  "rewarded",
  "expired",
]);

export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerUserId: uuid("referrer_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    refereeUserId: uuid("referee_user_id")
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
  userId: uuid("user_id")
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

// Stripe subscriptions
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "pro",
  "team",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "incomplete",
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  plan: subscriptionPlanEnum("plan").default("free").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Monitoring ───────────────────────────────────────────────

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
