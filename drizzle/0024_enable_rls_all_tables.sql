-- Enable Row Level Security on all tables
-- This migration addresses Supabase security advisor warnings about tables without RLS
--
-- Since this app uses Clerk authentication (not Supabase Auth), and all database
-- operations go through Next.js API routes using the service_role key (which bypasses RLS),
-- we enable RLS with restrictive policies that block direct PostgREST API access.

-- ============================================================================
-- ENABLE RLS ON ALL TABLES (76 tables)
-- ============================================================================

-- Core User & Auth Tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

-- Entity Management
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE smsf_details ENABLE ROW LEVEL SECURITY;

-- SMSF Compliance
ALTER TABLE smsf_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE smsf_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smsf_pensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smsf_compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE smsf_audit_items ENABLE ROW LEVEL SECURITY;

-- Trust Compliance
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_allocations ENABLE ROW LEVEL SECURITY;

-- Properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_performance_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_milestone_overrides ENABLE ROW LEVEL SECURITY;

-- Banking & Transactions
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expected_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_examples ENABLE ROW LEVEL SECURITY;

-- Loans & Finance
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_packs ENABLE ROW LEVEL SECURITY;

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_assets ENABLE ROW LEVEL SECURITY;

-- Property Sales & CGT
ALTER TABLE property_sales ENABLE ROW LEVEL SECURITY;

-- Property Manager Integration
ALTER TABLE property_manager_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_manager_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_manager_sync_logs ENABLE ROW LEVEL SECURITY;

-- Email Integration
ALTER TABLE property_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_email_invoice_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_email_senders ENABLE ROW LEVEL SECURITY;

-- Alerts
ALTER TABLE connection_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;

-- Tax
ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_suggestions ENABLE ROW LEVEL SECURITY;

-- Forecasting & Scenarios
ALTER TABLE forecast_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_snapshots ENABLE ROW LEVEL SECURITY;

-- Notifications
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Portfolio Access
ALTER TABLE portfolio_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Compliance & Milestones
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_preferences ENABLE ROW LEVEL SECURITY;

-- Benchmarks (public reference data)
ALTER TABLE suburb_benchmarks ENABLE ROW LEVEL SECURITY;

-- Chat
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Feedback & Support
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notes ENABLE ROW LEVEL SECURITY;

-- Content (public)
ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_changelog_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================
-- Since this app uses Clerk auth with server-side queries (service_role bypasses RLS),
-- we create policies that:
-- 1. Block all anonymous/public PostgREST access
-- 2. Allow authenticated users to access only their own data
-- 3. Allow public read access for reference/content tables

-- Note: auth.uid() returns the Supabase Auth user ID. Since we use Clerk,
-- we deny access via PostgREST and rely on server-side service_role access.

-- ============================================================================
-- USER-OWNED TABLES (user_id column)
-- ============================================================================

-- Users table - users can only see their own record
CREATE POLICY "users_self_access" ON users
  FOR ALL USING (false);  -- Block PostgREST, use service_role for all access

-- User onboarding
CREATE POLICY "user_onboarding_owner" ON user_onboarding
  FOR ALL USING (false);

-- Entities
CREATE POLICY "entities_owner" ON entities
  FOR ALL USING (false);

-- Entity members
CREATE POLICY "entity_members_owner" ON entity_members
  FOR ALL USING (false);

-- Trust details
CREATE POLICY "trust_details_owner" ON trust_details
  FOR ALL USING (false);

-- SMSF details
CREATE POLICY "smsf_details_owner" ON smsf_details
  FOR ALL USING (false);

-- SMSF members
CREATE POLICY "smsf_members_owner" ON smsf_members
  FOR ALL USING (false);

-- SMSF contributions
CREATE POLICY "smsf_contributions_owner" ON smsf_contributions
  FOR ALL USING (false);

-- SMSF pensions
CREATE POLICY "smsf_pensions_owner" ON smsf_pensions
  FOR ALL USING (false);

-- SMSF compliance checks
CREATE POLICY "smsf_compliance_checks_owner" ON smsf_compliance_checks
  FOR ALL USING (false);

-- SMSF audit items
CREATE POLICY "smsf_audit_items_owner" ON smsf_audit_items
  FOR ALL USING (false);

-- Beneficiaries
CREATE POLICY "beneficiaries_owner" ON beneficiaries
  FOR ALL USING (false);

-- Trust distributions
CREATE POLICY "trust_distributions_owner" ON trust_distributions
  FOR ALL USING (false);

-- Distribution allocations
CREATE POLICY "distribution_allocations_owner" ON distribution_allocations
  FOR ALL USING (false);

-- Properties
CREATE POLICY "properties_owner" ON properties
  FOR ALL USING (false);

-- External listings
CREATE POLICY "external_listings_owner" ON external_listings
  FOR ALL USING (false);

-- Property values
CREATE POLICY "property_values_owner" ON property_values
  FOR ALL USING (false);

-- Property performance benchmarks
CREATE POLICY "property_performance_benchmarks_owner" ON property_performance_benchmarks
  FOR ALL USING (false);

-- Property milestone overrides
CREATE POLICY "property_milestone_overrides_owner" ON property_milestone_overrides
  FOR ALL USING (false);

-- Bank accounts
CREATE POLICY "bank_accounts_owner" ON bank_accounts
  FOR ALL USING (false);

-- Transactions
CREATE POLICY "transactions_owner" ON transactions
  FOR ALL USING (false);

-- Recurring transactions
CREATE POLICY "recurring_transactions_owner" ON recurring_transactions
  FOR ALL USING (false);

-- Expected transactions
CREATE POLICY "expected_transactions_owner" ON expected_transactions
  FOR ALL USING (false);

-- Merchant categories
CREATE POLICY "merchant_categories_owner" ON merchant_categories
  FOR ALL USING (false);

-- Categorization examples
CREATE POLICY "categorization_examples_owner" ON categorization_examples
  FOR ALL USING (false);

-- Loans
CREATE POLICY "loans_owner" ON loans
  FOR ALL USING (false);

-- Loan comparisons
CREATE POLICY "loan_comparisons_owner" ON loan_comparisons
  FOR ALL USING (false);

-- Refinance alerts
CREATE POLICY "refinance_alerts_owner" ON refinance_alerts
  FOR ALL USING (false);

-- Brokers
CREATE POLICY "brokers_owner" ON brokers
  FOR ALL USING (false);

-- Loan packs - has public token access, but block direct table access
CREATE POLICY "loan_packs_owner" ON loan_packs
  FOR ALL USING (false);

-- Documents
CREATE POLICY "documents_owner" ON documents
  FOR ALL USING (false);

-- Document extractions
CREATE POLICY "document_extractions_owner" ON document_extractions
  FOR ALL USING (false);

-- Depreciation schedules
CREATE POLICY "depreciation_schedules_owner" ON depreciation_schedules
  FOR ALL USING (false);

-- Depreciation assets
CREATE POLICY "depreciation_assets_owner" ON depreciation_assets
  FOR ALL USING (false);

-- Property sales
CREATE POLICY "property_sales_owner" ON property_sales
  FOR ALL USING (false);

-- Property manager connections
CREATE POLICY "property_manager_connections_owner" ON property_manager_connections
  FOR ALL USING (false);

-- Property manager mappings
CREATE POLICY "property_manager_mappings_owner" ON property_manager_mappings
  FOR ALL USING (false);

-- Property manager sync logs
CREATE POLICY "property_manager_sync_logs_owner" ON property_manager_sync_logs
  FOR ALL USING (false);

-- Property emails
CREATE POLICY "property_emails_owner" ON property_emails
  FOR ALL USING (false);

-- Property email attachments
CREATE POLICY "property_email_attachments_owner" ON property_email_attachments
  FOR ALL USING (false);

-- Property email invoice matches
CREATE POLICY "property_email_invoice_matches_owner" ON property_email_invoice_matches
  FOR ALL USING (false);

-- Property email senders
CREATE POLICY "property_email_senders_owner" ON property_email_senders
  FOR ALL USING (false);

-- Connection alerts
CREATE POLICY "connection_alerts_owner" ON connection_alerts
  FOR ALL USING (false);

-- Anomaly alerts
CREATE POLICY "anomaly_alerts_owner" ON anomaly_alerts
  FOR ALL USING (false);

-- Tax profiles
CREATE POLICY "tax_profiles_owner" ON tax_profiles
  FOR ALL USING (false);

-- Tax suggestions
CREATE POLICY "tax_suggestions_owner" ON tax_suggestions
  FOR ALL USING (false);

-- Forecast scenarios
CREATE POLICY "forecast_scenarios_owner" ON forecast_scenarios
  FOR ALL USING (false);

-- Cash flow forecasts
CREATE POLICY "cash_flow_forecasts_owner" ON cash_flow_forecasts
  FOR ALL USING (false);

-- Scenarios
CREATE POLICY "scenarios_owner" ON scenarios
  FOR ALL USING (false);

-- Scenario factors
CREATE POLICY "scenario_factors_owner" ON scenario_factors
  FOR ALL USING (false);

-- Scenario projections
CREATE POLICY "scenario_projections_owner" ON scenario_projections
  FOR ALL USING (false);

-- Scenario snapshots
CREATE POLICY "scenario_snapshots_owner" ON scenario_snapshots
  FOR ALL USING (false);

-- Notification preferences
CREATE POLICY "notification_preferences_owner" ON notification_preferences
  FOR ALL USING (false);

-- Push subscriptions
CREATE POLICY "push_subscriptions_owner" ON push_subscriptions
  FOR ALL USING (false);

-- Notification log
CREATE POLICY "notification_log_owner" ON notification_log
  FOR ALL USING (false);

-- Push tokens
CREATE POLICY "push_tokens_owner" ON push_tokens
  FOR ALL USING (false);

-- Portfolio members
CREATE POLICY "portfolio_members_owner" ON portfolio_members
  FOR ALL USING (false);

-- Portfolio invites
CREATE POLICY "portfolio_invites_owner" ON portfolio_invites
  FOR ALL USING (false);

-- Portfolio shares - has public token access, but block direct table access
CREATE POLICY "portfolio_shares_owner" ON portfolio_shares
  FOR ALL USING (false);

-- Audit log
CREATE POLICY "audit_log_owner" ON audit_log
  FOR ALL USING (false);

-- Compliance records
CREATE POLICY "compliance_records_owner" ON compliance_records
  FOR ALL USING (false);

-- Equity milestones
CREATE POLICY "equity_milestones_owner" ON equity_milestones
  FOR ALL USING (false);

-- Milestone preferences
CREATE POLICY "milestone_preferences_owner" ON milestone_preferences
  FOR ALL USING (false);

-- Chat conversations
CREATE POLICY "chat_conversations_owner" ON chat_conversations
  FOR ALL USING (false);

-- Chat messages
CREATE POLICY "chat_messages_owner" ON chat_messages
  FOR ALL USING (false);

-- Feature requests
CREATE POLICY "feature_requests_owner" ON feature_requests
  FOR ALL USING (false);

-- Feature votes
CREATE POLICY "feature_votes_owner" ON feature_votes
  FOR ALL USING (false);

-- Feature comments
CREATE POLICY "feature_comments_owner" ON feature_comments
  FOR ALL USING (false);

-- Bug reports
CREATE POLICY "bug_reports_owner" ON bug_reports
  FOR ALL USING (false);

-- Support tickets
CREATE POLICY "support_tickets_owner" ON support_tickets
  FOR ALL USING (false);

-- Ticket notes
CREATE POLICY "ticket_notes_owner" ON ticket_notes
  FOR ALL USING (false);

-- User changelog views
CREATE POLICY "user_changelog_views_owner" ON user_changelog_views
  FOR ALL USING (false);


-- ============================================================================
-- PUBLIC REFERENCE DATA TABLES (allow public read access)
-- ============================================================================

-- Suburb benchmarks - public reference data
CREATE POLICY "suburb_benchmarks_public_read" ON suburb_benchmarks
  FOR SELECT USING (true);

CREATE POLICY "suburb_benchmarks_no_write" ON suburb_benchmarks
  FOR INSERT WITH CHECK (false);

CREATE POLICY "suburb_benchmarks_no_update" ON suburb_benchmarks
  FOR UPDATE USING (false);

CREATE POLICY "suburb_benchmarks_no_delete" ON suburb_benchmarks
  FOR DELETE USING (false);

-- Rate history - public reference data
CREATE POLICY "rate_history_public_read" ON rate_history
  FOR SELECT USING (true);

CREATE POLICY "rate_history_no_write" ON rate_history
  FOR INSERT WITH CHECK (false);

CREATE POLICY "rate_history_no_update" ON rate_history
  FOR UPDATE USING (false);

CREATE POLICY "rate_history_no_delete" ON rate_history
  FOR DELETE USING (false);

-- Changelog entries - public content
CREATE POLICY "changelog_entries_public_read" ON changelog_entries
  FOR SELECT USING (true);

CREATE POLICY "changelog_entries_no_write" ON changelog_entries
  FOR INSERT WITH CHECK (false);

CREATE POLICY "changelog_entries_no_update" ON changelog_entries
  FOR UPDATE USING (false);

CREATE POLICY "changelog_entries_no_delete" ON changelog_entries
  FOR DELETE USING (false);

-- Blog posts - public content
CREATE POLICY "blog_posts_public_read" ON blog_posts
  FOR SELECT USING (true);

CREATE POLICY "blog_posts_no_write" ON blog_posts
  FOR INSERT WITH CHECK (false);

CREATE POLICY "blog_posts_no_update" ON blog_posts
  FOR UPDATE USING (false);

CREATE POLICY "blog_posts_no_delete" ON blog_posts
  FOR DELETE USING (false);


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "users_self_access" ON users IS
  'Block PostgREST access. All user data access via service_role through API routes.';

COMMENT ON POLICY "suburb_benchmarks_public_read" ON suburb_benchmarks IS
  'Allow public read access to suburb benchmark reference data.';

COMMENT ON POLICY "blog_posts_public_read" ON blog_posts IS
  'Allow public read access to published blog posts.';

COMMENT ON POLICY "changelog_entries_public_read" ON changelog_entries IS
  'Allow public read access to changelog entries.';

COMMENT ON POLICY "rate_history_public_read" ON rate_history IS
  'Allow public read access to historical cash rate data.';
