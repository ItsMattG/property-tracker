-- Add performance indexes for common query patterns

-- Transactions by user and date (filtering dashboards, reports)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
ON transactions (user_id, date DESC);

-- Properties by user (property list queries)
CREATE INDEX IF NOT EXISTS idx_properties_user_id
ON properties (user_id);

-- Bank accounts by Basiq connection ID (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_bank_accounts_basiq_connection
ON bank_accounts (basiq_connection_id)
WHERE basiq_connection_id IS NOT NULL;

-- Expected transactions by user and status (cron job queries)
CREATE INDEX IF NOT EXISTS idx_expected_transactions_user_status
ON expected_transactions (user_id, status);

-- Recurring transactions by active status
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_active
ON recurring_transactions (is_active)
WHERE is_active = true;
