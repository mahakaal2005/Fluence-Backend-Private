-- Simplify to fund-based system
-- This migration removes campaign dependency from transactions

-- Add cashback_percentage to merchant_budgets (merchants can set their own percentage)
ALTER TABLE merchant_budgets
ADD COLUMN IF NOT EXISTS cashback_percentage DECIMAL(5,2) DEFAULT 5.00 CHECK (cashback_percentage > 0 AND cashback_percentage <= 100);

-- Make campaign_id nullable in cashback_transactions (no longer required)
ALTER TABLE cashback_transactions
ALTER COLUMN campaign_id DROP NOT NULL;

-- Remove foreign key constraint on campaign_id if it exists
ALTER TABLE cashback_transactions
DROP CONSTRAINT IF EXISTS cashback_transactions_campaign_id_fkey;

-- Add index for merchant funds lookup
CREATE INDEX IF NOT EXISTS idx_merchant_budgets_merchant_id_active ON merchant_budgets (merchant_id, status) WHERE status = 'active';

COMMENT ON COLUMN merchant_budgets.cashback_percentage IS 'Default cashback percentage for this merchant (can be overridden per transaction)';
COMMENT ON COLUMN cashback_transactions.campaign_id IS 'Deprecated: No longer used in fund-based system. Can be NULL.';

