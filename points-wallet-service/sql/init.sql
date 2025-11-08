-- Points & Wallet Service Database Schema
-- This service handles all points and wallet operations

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- Points Transactions Table
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  amount INTEGER NOT NULL, -- Points amount (can be negative for deductions)
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'cashback', 'referral', 'redemption', 'adjustment', 'bonus', 'penalty')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'expired', 'cancelled', 'failed')),
  description TEXT,
  reference_id TEXT, -- External reference (order ID, etc.)
  social_post_required BOOLEAN DEFAULT FALSE,
  social_post_made BOOLEAN DEFAULT FALSE,
  social_post_verified BOOLEAN DEFAULT FALSE,
  social_post_url TEXT,
  time_buffer_ends_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- When points expire
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet Balances Table
CREATE TABLE IF NOT EXISTS wallet_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE, -- References auth service users
  available_balance INTEGER NOT NULL DEFAULT 0, -- Points available for use
  pending_balance INTEGER NOT NULL DEFAULT 0, -- Points pending approval
  total_earned INTEGER NOT NULL DEFAULT 0, -- Total points ever earned
  total_redeemed INTEGER NOT NULL DEFAULT 0, -- Total points ever redeemed
  total_expired INTEGER NOT NULL DEFAULT 0, -- Total points that expired
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points Redemptions Table
CREATE TABLE IF NOT EXISTS points_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  points_amount INTEGER NOT NULL,
  redemption_type TEXT NOT NULL CHECK (redemption_type IN ('cash', 'gift_card', 'product', 'donation', 'transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  description TEXT,
  reference_id TEXT, -- External reference
  processed_by UUID, -- Admin who processed the redemption
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points Expiration Tracking
CREATE TABLE IF NOT EXISTS points_expiration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  transaction_id UUID NOT NULL REFERENCES points_transactions(id),
  points_amount INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  expired_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'extended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points Categories (for different types of points)
CREATE TABLE IF NOT EXISTS points_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  expiration_days INTEGER DEFAULT 365, -- Days until points expire
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Points Preferences
CREATE TABLE IF NOT EXISTS user_points_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE, -- References auth service users
  auto_redemption_enabled BOOLEAN DEFAULT false,
  redemption_threshold INTEGER DEFAULT 1000, -- Minimum points for auto-redemption
  notification_enabled BOOLEAN DEFAULT true,
  expiration_warning_days INTEGER DEFAULT 30, -- Days before expiration to warn
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points Audit Log
CREATE TABLE IF NOT EXISTS points_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  action TEXT NOT NULL, -- 'earn', 'redeem', 'expire', 'adjust', 'transfer'
  points_amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  transaction_id UUID REFERENCES points_transactions(id),
  admin_id UUID, -- Admin who performed the action
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_points_transactions_status ON points_transactions (status);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON points_transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_points_transactions_expires_at ON points_transactions (expires_at);
CREATE INDEX IF NOT EXISTS idx_points_transactions_reference_id ON points_transactions (reference_id);

CREATE INDEX IF NOT EXISTS idx_wallet_balances_user_id ON wallet_balances (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_last_updated ON wallet_balances (last_updated_at);

CREATE INDEX IF NOT EXISTS idx_points_redemptions_user_id ON points_redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_points_redemptions_status ON points_redemptions (status);
CREATE INDEX IF NOT EXISTS idx_points_redemptions_created_at ON points_redemptions (created_at);

CREATE INDEX IF NOT EXISTS idx_points_expiration_user_id ON points_expiration (user_id);
CREATE INDEX IF NOT EXISTS idx_points_expiration_expires_at ON points_expiration (expires_at);
CREATE INDEX IF NOT EXISTS idx_points_expiration_status ON points_expiration (status);

CREATE INDEX IF NOT EXISTS idx_user_points_preferences_user_id ON user_points_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_points_audit_log_user_id ON points_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_points_audit_log_created_at ON points_audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_points_audit_log_action ON points_audit_log (action);

-- Function to update wallet balance
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

-- Trigger to automatically update wallet balance
CREATE TRIGGER trigger_update_wallet_balance
  AFTER INSERT OR UPDATE ON points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance();

-- Function to log points audit
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

-- Trigger to log points audit
CREATE TRIGGER trigger_log_points_audit
  AFTER INSERT OR UPDATE ON points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION log_points_audit();

-- Function to handle points expiration
CREATE OR REPLACE FUNCTION handle_points_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Create expiration tracking record
  IF NEW.expires_at IS NOT NULL THEN
    INSERT INTO points_expiration (
      user_id, transaction_id, points_amount, expires_at
    ) VALUES (
      NEW.user_id, NEW.id, NEW.amount, NEW.expires_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to handle points expiration
CREATE TRIGGER trigger_handle_points_expiration
  AFTER INSERT ON points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_points_expiration();

-- Insert default points categories
INSERT INTO points_categories (name, description, expiration_days) VALUES
('purchase', 'Points earned from purchases', 365),
('cashback', 'Cashback points', 365),
('referral', 'Referral bonus points', 365),
('bonus', 'Promotional bonus points', 180),
('social', 'Social media engagement points', 90),
('adjustment', 'Manual adjustment points', 365)
ON CONFLICT (name) DO NOTHING;
