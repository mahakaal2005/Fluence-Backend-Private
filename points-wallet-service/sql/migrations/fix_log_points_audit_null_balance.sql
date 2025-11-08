-- Migration: Fix log_points_audit function to handle NULL balance
-- Date: 2025-11-08
-- Description: Fixes the trigger function to handle cases where users don't have a wallet balance yet
--              by defaulting to 0 instead of NULL, preventing NOT NULL constraint violations

-- Update the log_points_audit function to handle NULL balance
CREATE OR REPLACE FUNCTION log_points_audit()
RETURNS TRIGGER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance, default to 0 if wallet doesn't exist yet
  SELECT available_balance INTO current_balance 
  FROM wallet_balances 
  WHERE user_id = NEW.user_id;
  
  -- If no wallet exists (no row found), current_balance will be NULL, so default to 0
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;
  
  -- Log the audit entry
  INSERT INTO points_audit_log (
    user_id, action, points_amount, balance_before, balance_after,
    transaction_id, reason, metadata
  ) VALUES (
    NEW.user_id, 
    CASE 
      WHEN NEW.amount > 0 THEN 'earn'
      WHEN NEW.amount < 0 THEN 'redeem'
      ELSE 'adjust'
    END,
    NEW.amount,
    current_balance - NEW.amount,
    current_balance,
    NEW.id,
    NEW.description,
    jsonb_build_object(
      'transaction_type', NEW.transaction_type,
      'status', NEW.status,
      'reference_id', NEW.reference_id
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger is already created, so we don't need to recreate it
-- The function update above will automatically apply to the existing trigger

