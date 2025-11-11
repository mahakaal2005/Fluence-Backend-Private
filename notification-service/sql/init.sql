-- Notification Service Database Schema
-- This service handles all notifications across the Fluence Pay ecosystem

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- Notification Templates Table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'in_app')),
  subject VARCHAR(255),
  template TEXT NOT NULL,
  variables JSONB, -- Template variables and their types
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID, -- References auth service users
  template_id UUID REFERENCES notification_templates(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms', 'push', 'in_app')),
  recipient VARCHAR(255) NOT NULL, -- email, phone, device token, etc.
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ, -- When user opened the notification
  clicked_at TIMESTAMPTZ, -- When user clicked on the notification
  error_message TEXT,
  metadata JSONB, -- Additional data like campaign info, user preferences, etc.
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  email_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly', 'never')),
  sms_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (sms_frequency IN ('immediate', 'daily', 'weekly', 'never')),
  push_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (push_frequency IN ('immediate', 'daily', 'weekly', 'never')),
  categories JSONB, -- Notification categories and their preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Queues Table (for batch processing)
CREATE TABLE IF NOT EXISTS notification_queues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_name VARCHAR(100) NOT NULL,
  notification_ids UUID[] NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Analytics Table
CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  delivery_rate DECIMAL(5,2) DEFAULT 0.00,
  read_rate DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_templates_name ON notification_templates (name);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates (type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates (is_active);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_template_id ON notifications (template_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications (sent_at);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_queues_queue_name ON notification_queues (queue_name);
CREATE INDEX IF NOT EXISTS idx_notification_queues_status ON notification_queues (status);
CREATE INDEX IF NOT EXISTS idx_notification_queues_scheduled_at ON notification_queues (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_notification_analytics_date ON notification_analytics (date);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_type ON notification_analytics (type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_analytics_date_type_unique ON notification_analytics (date, type);

-- Function to update notification status
CREATE OR REPLACE FUNCTION update_notification_status()
RETURNS TRIGGER AS $$
DECLARE
  sent_increment INTEGER := CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END;
  delivered_increment INTEGER := CASE WHEN NEW.status = 'delivered' THEN 1 ELSE 0 END;
  failed_increment INTEGER := CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END;
  read_increment INTEGER := CASE WHEN NEW.status = 'read' THEN 1 ELSE 0 END;
BEGIN
  -- Update analytics when notification status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notification_analytics (
      date,
      type,
      total_sent,
      total_delivered,
      total_failed,
      total_read,
      delivery_rate,
      read_rate,
      created_at,
      updated_at
    )
    VALUES (
      CURRENT_DATE,
      NEW.type,
      sent_increment,
      delivered_increment,
      failed_increment,
      read_increment,
      CASE
        WHEN sent_increment > 0 THEN
          (delivered_increment::DECIMAL / NULLIF(sent_increment, 0)) * 100
        ELSE 0
      END,
      CASE
        WHEN delivered_increment > 0 THEN
          (read_increment::DECIMAL / NULLIF(delivered_increment, 0)) * 100
        ELSE 0
      END,
      NOW(),
      NOW()
    )
    ON CONFLICT (date, type) DO UPDATE SET
      total_sent = notification_analytics.total_sent + sent_increment,
      total_delivered = notification_analytics.total_delivered + delivered_increment,
      total_failed = notification_analytics.total_failed + failed_increment,
      total_read = notification_analytics.total_read + read_increment,
      delivery_rate = CASE
        WHEN (notification_analytics.total_sent + sent_increment) > 0 THEN
          ((notification_analytics.total_delivered + delivered_increment)::DECIMAL /
           (notification_analytics.total_sent + sent_increment)) * 100
        ELSE 0
      END,
      read_rate = CASE
        WHEN (notification_analytics.total_delivered + delivered_increment) > 0 THEN
          ((notification_analytics.total_read + read_increment)::DECIMAL /
           (notification_analytics.total_delivered + delivered_increment)) * 100
        ELSE 0
      END,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics
CREATE TRIGGER trigger_update_notification_analytics
  AFTER UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_status();

-- Help Content Table
CREATE TABLE IF NOT EXISTS help_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID -- References auth service users
);

-- FAQ Content Table
CREATE TABLE IF NOT EXISTS faq_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID -- References auth service users
);

-- Terms & Conditions Table
CREATE TABLE IF NOT EXISTS terms_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  effective_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID -- References auth service users
);

-- Privacy Policy Table
CREATE TABLE IF NOT EXISTS privacy_policy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  effective_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID -- References auth service users
);

-- Indexes for content management
CREATE INDEX IF NOT EXISTS idx_help_content_category ON help_content (category);
CREATE INDEX IF NOT EXISTS idx_help_content_active ON help_content (is_active);
CREATE INDEX IF NOT EXISTS idx_help_content_created_at ON help_content (created_at);

CREATE INDEX IF NOT EXISTS idx_faq_content_category ON faq_content (category);
CREATE INDEX IF NOT EXISTS idx_faq_content_active ON faq_content (is_active);
CREATE INDEX IF NOT EXISTS idx_faq_content_created_at ON faq_content (created_at);

CREATE INDEX IF NOT EXISTS idx_terms_conditions_version ON terms_conditions (version);
CREATE INDEX IF NOT EXISTS idx_terms_conditions_active ON terms_conditions (is_active);
CREATE INDEX IF NOT EXISTS idx_terms_conditions_effective_date ON terms_conditions (effective_date);

CREATE INDEX IF NOT EXISTS idx_privacy_policy_version ON privacy_policy (version);
CREATE INDEX IF NOT EXISTS idx_privacy_policy_active ON privacy_policy (is_active);
CREATE INDEX IF NOT EXISTS idx_privacy_policy_effective_date ON privacy_policy (effective_date);

-- Insert default notification templates
INSERT INTO notification_templates (name, type, subject, template, variables) VALUES
('merchant_application_submitted', 'email', 'Merchant Application Submitted - Fluence Pay', 
 'Dear {{contactPerson}},\n\nThank you for submitting your merchant application for {{businessName}}.\n\nYour application has been received and is currently under review. Our team will review your application within 48 hours.\n\nApplication Details:\n- Business Name: {{businessName}}\n- Contact Person: {{contactPerson}}\n- Email: {{email}}\n- Status: Pending Review\n\nYou will receive an email notification once your application has been reviewed.\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nFluence Pay Team',
 '{"contactPerson": "string", "businessName": "string", "email": "string"}'),

('merchant_application_approved', 'email', 'Merchant Application Approved - Fluence Pay',
 'Dear {{contactPerson}},\n\nCongratulations! Your merchant application for {{businessName}} has been approved.\n\nYour merchant profile has been created and you can now:\n- Access the merchant dashboard\n- Configure your cashback campaigns\n- Manage your budget and settings\n\nNext Steps:\n1. Log in to your merchant account\n2. Complete your profile setup\n3. Configure your first cashback campaign\n\nIf you have any questions, please contact our support team.\n\nWelcome to Fluence Pay!\n\nBest regards,\nFluence Pay Team',
 '{"contactPerson": "string", "businessName": "string"}'),

('merchant_application_rejected', 'email', 'Merchant Application Update - Fluence Pay',
 'Dear {{contactPerson}},\n\nThank you for your interest in joining Fluence Pay as a merchant.\n\nAfter careful review, we regret to inform you that your application for {{businessName}} has not been approved at this time.\n\nReason for rejection:\n{{rejectionReason}}\n\nYou are welcome to reapply in the future if your circumstances change or if you can address the concerns mentioned above.\n\nIf you have any questions or would like to discuss this decision, please contact our support team.\n\nBest regards,\nFluence Pay Team',
 '{"contactPerson": "string", "businessName": "string", "rejectionReason": "string"}'),

('budget_threshold_alert', 'email', 'Budget Alert - Fluence Pay',
 'Dear {{merchantName}},\n\nYour budget utilization has reached {{currentPercentage}}%.\n\nCurrent Budget Status:\n- Total Loaded: {{totalLoaded}} AED\n- Total Spent: {{totalSpent}} AED\n- Current Balance: {{currentBalance}} AED\n- Utilization: {{currentPercentage}}%\n\nPlease consider reloading your budget to continue your cashback campaigns.\n\nBest regards,\nFluence Pay Team',
 '{"merchantName": "string", "currentPercentage": "number", "totalLoaded": "number", "totalSpent": "number", "currentBalance": "number"}'),

('budget_auto_stop', 'email', 'Budget Auto-Stop Alert - Fluence Pay',
 'Dear {{merchantName}},\n\nYour cashback campaigns have been automatically paused because your budget utilization has reached {{currentPercentage}}%.\n\nThis is to prevent overspending and ensure you stay within your budget limits.\n\nTo resume your campaigns:\n1. Log in to your merchant dashboard\n2. Reload your budget\n3. Reactivate your campaigns\n\nCurrent Budget Status:\n- Total Loaded: {{totalLoaded}} AED\n- Total Spent: {{totalSpent}} AED\n- Current Balance: {{currentBalance}} AED\n\nBest regards,\nFluence Pay Team',
 '{"merchantName": "string", "currentPercentage": "number", "totalLoaded": "number", "totalSpent": "number", "currentBalance": "number"}'),

('cashback_processed', 'email', 'Cashback Processed - Fluence Pay',
 'Dear {{customerName}},\n\nYour cashback of {{cashbackAmount}} AED has been processed for your recent purchase.\n\nTransaction Details:\n- Original Amount: {{originalAmount}} AED\n- Cashback Percentage: {{cashbackPercentage}}%\n- Cashback Amount: {{cashbackAmount}} AED\n- Merchant: {{merchantName}}\n\nThank you for using Fluence Pay!\n\nBest regards,\nFluence Pay Team',
 '{"customerName": "string", "cashbackAmount": "number", "originalAmount": "number", "cashbackPercentage": "number", "merchantName": "string"}'),

('dispute_created', 'email', 'Dispute Created - Fluence Pay',
 'Dear {{merchantName}},\n\nA new dispute has been created for transaction {{transactionId}}.\n\nDispute Details:\n- Type: {{disputeType}}\n- Title: {{disputeTitle}}\n- Description: {{disputeDescription}}\n- Priority: {{priority}}\n\nPlease review and respond to this dispute within 48 hours.\n\nBest regards,\nFluence Pay Team',
 '{"merchantName": "string", "transactionId": "string", "disputeType": "string", "disputeTitle": "string", "disputeDescription": "string", "priority": "string"}'),

('dispute_resolved', 'email', 'Dispute Resolved - Fluence Pay',
 'Dear {{merchantName}},\n\nYour dispute for transaction {{transactionId}} has been resolved.\n\nResolution: {{resolution}}\n\nIf you have any questions about this resolution, please contact our support team.\n\nBest regards,\nFluence Pay Team',
 '{"merchantName": "string", "transactionId": "string", "resolution": "string"}')

ON CONFLICT (name) DO NOTHING;
