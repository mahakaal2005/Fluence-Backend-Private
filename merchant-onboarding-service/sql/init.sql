-- Merchant Onboarding Service Database Schema
-- This service handles merchant applications and profile management

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- Merchant Applications Table
CREATE TABLE IF NOT EXISTS merchant_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100) NOT NULL CHECK (business_type IN ('retail', 'restaurant', 'service', 'ecommerce', 'other')),
  contact_person VARCHAR(255) NOT NULL,
  email CITEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  business_address TEXT NOT NULL,
  business_license VARCHAR(100),
  tax_id VARCHAR(100),
  bank_account_details JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID, -- References auth service admin users
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchant Profiles Table (created after approval)
CREATE TABLE IF NOT EXISTS merchant_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES merchant_applications(id),
  user_id UUID NOT NULL, -- References auth service users
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100) NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  email CITEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  business_address TEXT NOT NULL,
  business_license VARCHAR(100),
  tax_id VARCHAR(100),
  bank_account_details JSONB,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  -- Merchant auth fields (no dependency on users table)
  password_hash TEXT,
  password_set_at TIMESTAMPTZ,
  login_enabled BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER DEFAULT 0,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID, -- References auth service admin users
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application Status History (audit trail)
CREATE TABLE IF NOT EXISTS application_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES merchant_applications(id),
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID, -- References auth service users
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Log (for tracking sent notifications)
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES merchant_applications(id),
  merchant_id UUID REFERENCES merchant_profiles(id),
  notification_type VARCHAR(50) NOT NULL,
  recipient_email CITEXT NOT NULL,
  subject VARCHAR(255),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_merchant_applications_user_id ON merchant_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_status ON merchant_applications (status);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_submitted_at ON merchant_applications (submitted_at);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_reviewed_by ON merchant_applications (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_merchant_profiles_user_id ON merchant_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_status ON merchant_profiles (status);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_approved_at ON merchant_profiles (approved_at);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_email ON merchant_profiles (email);
CREATE INDEX IF NOT EXISTS idx_merchant_profiles_login_enabled ON merchant_profiles (login_enabled);

CREATE INDEX IF NOT EXISTS idx_application_status_history_application_id ON application_status_history (application_id);
CREATE INDEX IF NOT EXISTS idx_application_status_history_created_at ON application_status_history (created_at);

CREATE INDEX IF NOT EXISTS idx_notification_log_application_id ON notification_log (application_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_merchant_id ON notification_log (merchant_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log (status);
CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log (created_at);

-- Function to update application status and log changes
CREATE OR REPLACE FUNCTION update_application_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO application_status_history (
      application_id,
      previous_status,
      new_status,
      changed_by,
      reason,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.reviewed_by,
      NEW.rejection_reason,
      NEW.admin_notes
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log status changes
CREATE TRIGGER trigger_update_application_status
  AFTER UPDATE ON merchant_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_application_status();

-- Function to create merchant profile when application is approved
CREATE OR REPLACE FUNCTION create_merchant_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if status changed to 'approved'
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    INSERT INTO merchant_profiles (
      application_id,
      user_id,
      business_name,
      business_type,
      contact_person,
      email,
      phone,
      business_address,
      business_license,
      tax_id,
      bank_account_details,
      approved_by
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.business_name,
      NEW.business_type,
      NEW.contact_person,
      NEW.email,
      NEW.phone,
      NEW.business_address,
      NEW.business_license,
      NEW.tax_id,
      NEW.bank_account_details,
      NEW.reviewed_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create merchant profile on approval
CREATE TRIGGER trigger_create_merchant_profile
  AFTER UPDATE ON merchant_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_merchant_profile();

-- Insert default admin user reference (this would be managed by auth service)
-- This is just a placeholder - in reality, admin users would be managed by the auth service
INSERT INTO merchant_applications (
  user_id,
  business_name,
  business_type,
  contact_person,
  email,
  phone,
  business_address,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- Placeholder UUID
  'System Admin',
  'service',
  'System Administrator',
  'admin@fluencepay.com',
  '+971501234567',
  'Dubai, UAE',
  'approved',
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000'
) ON CONFLICT DO NOTHING;
