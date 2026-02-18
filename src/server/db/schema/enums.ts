// All pgEnum definitions, centralized since enums are shared across domains.
import { pgEnum } from "./_common";

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

export const propertyPurposeEnum = pgEnum("property_purpose", [
  "investment",
  "owner_occupied",
  "commercial",
  "short_term_rental",
]);

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
  "failed",
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

export const emailProviderEnum = pgEnum("email_provider", ["gmail", "outlook"]);

export const emailConnectionStatusEnum = pgEnum("email_connection_status", [
  "active",
  "needs_reauth",
  "disconnected",
]);

export const emailSourceEnum = pgEnum("email_source", [
  "forwarded",
  "gmail",
  "outlook",
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

// Chat AI Assistant
export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

// Referral system
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "qualified",
  "rewarded",
  "expired",
]);

// Budget tracker
export const budgetGroupEnum = pgEnum("budget_group", [
  "needs",
  "wants",
  "savings",
]);

export const defaultTransactionTypeEnum = pgEnum("default_transaction_type", [
  "property",
  "personal",
  "ask",
]);

// Stripe subscriptions
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "pro",
  "team",
  "lifetime",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "incomplete",
]);
