-- Add composite index for transaction queries filtered by property
-- This optimizes the common pattern of listing transactions for a specific property

CREATE INDEX IF NOT EXISTS idx_transactions_user_property_date
ON transactions (user_id, property_id, date DESC);

-- Also add index for the count query which needs to quickly count total rows
CREATE INDEX IF NOT EXISTS idx_transactions_user_property
ON transactions (user_id, property_id);
