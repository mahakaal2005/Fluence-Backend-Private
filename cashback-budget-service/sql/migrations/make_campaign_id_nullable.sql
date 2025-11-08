-- Make campaign_id nullable in cashback_transactions
-- This allows transactions to be created without a campaign (fund-based system)

-- Drop the foreign key constraint first
ALTER TABLE cashback_transactions
DROP CONSTRAINT IF EXISTS cashback_transactions_campaign_id_fkey;

-- Make campaign_id nullable
ALTER TABLE cashback_transactions
ALTER COLUMN campaign_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN cashback_transactions.campaign_id IS 'Deprecated: No longer used in fund-based system. Can be NULL.';

