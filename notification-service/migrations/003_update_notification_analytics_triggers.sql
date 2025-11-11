-- Migration: Fix notification analytics trigger recursion and inline rate calculations

-- Remove the recursive trigger/function if they exist
DROP TRIGGER IF EXISTS trigger_calculate_notification_rates ON notification_analytics;
DROP FUNCTION IF EXISTS calculate_notification_rates();

-- Ensure unique index exists for upsert logic
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_analytics_date_type_unique
  ON notification_analytics (date, type);

-- Update update_notification_status function to compute rates inline
CREATE OR REPLACE FUNCTION update_notification_status()
RETURNS TRIGGER AS $$
DECLARE
  sent_increment INTEGER := CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END;
  delivered_increment INTEGER := CASE WHEN NEW.status = 'delivered' THEN 1 ELSE 0 END;
  failed_increment INTEGER := CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END;
  read_increment INTEGER := CASE WHEN NEW.status = 'read' THEN 1 ELSE 0 END;
BEGIN
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
