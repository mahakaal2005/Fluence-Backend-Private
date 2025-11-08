-- Migration: Fix pending balance double update issue
-- Date: 2025-11-08
-- Description: Fixes the trigger function to properly increment pending_balance instead of setting it to itself
--              This prevents double counting when transactions are created

-- Update the update_wallet_balance function to properly increment pending_balance
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update wallet_balances table
  IF TG_OP = 'INSERT' THEN
    -- Pending transactions increase pending_balance; available increase available_balance
    IF NEW.status = 'pending' THEN
      UPDATE wallet_balances 
      SET 
        pending_balance = pending_balance + NEW.amount,
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE user_id = NEW.user_id;

      INSERT INTO wallet_balances (user_id, pending_balance)
      SELECT NEW.user_id, NEW.amount
      WHERE NOT EXISTS (SELECT 1 FROM wallet_balances WHERE user_id = NEW.user_id);
    ELSIF NEW.status = 'available' THEN
      UPDATE wallet_balances 
      SET 
        available_balance = available_balance + NEW.amount,
        total_earned = total_earned + CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
        total_redeemed = total_redeemed + CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END,
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE user_id = NEW.user_id;
      
      INSERT INTO wallet_balances (user_id, available_balance, total_earned, total_redeemed)
      SELECT NEW.user_id, NEW.amount, 
             CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
             CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END
      WHERE NOT EXISTS (SELECT 1 FROM wallet_balances WHERE user_id = NEW.user_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle status changes
    IF OLD.status != NEW.status AND NEW.status = 'available' THEN
      -- move from pending to available
      UPDATE wallet_balances 
      SET 
        pending_balance = GREATEST(pending_balance - NEW.amount, 0),
        available_balance = available_balance + NEW.amount,
        total_earned = total_earned + CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
        total_redeemed = total_redeemed + CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END,
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE user_id = NEW.user_id;
    ELSIF OLD.status != NEW.status AND NEW.status = 'pending' THEN
      -- move back to pending from available
      UPDATE wallet_balances 
      SET 
        available_balance = GREATEST(available_balance - NEW.amount, 0),
        pending_balance = pending_balance + NEW.amount,
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE user_id = NEW.user_id;
    ELSIF OLD.status != NEW.status AND OLD.status = 'available' AND NEW.status != 'available' THEN
      -- leaving available to a non-available/non-pending status
      UPDATE wallet_balances 
      SET 
        available_balance = available_balance - NEW.amount,
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger is already created, so we don't need to recreate it
-- The function update above will automatically apply to the existing trigger

