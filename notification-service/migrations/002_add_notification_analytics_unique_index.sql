-- Migration: Ensure notification_analytics supports upserts by date/type
-- Adds a unique index on (date, type) so ON CONFLICT (date, type) works as expected

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_analytics_date_type_unique
  ON notification_analytics (date, type);
