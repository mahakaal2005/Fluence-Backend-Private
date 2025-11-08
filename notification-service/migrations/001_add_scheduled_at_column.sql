-- Migration: Add scheduled_at column for scheduled notifications
-- This enables the ability to schedule notifications for future delivery

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add index for efficient querying of scheduled notifications
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications (scheduled_at);

-- Comment on the column
COMMENT ON COLUMN notifications.scheduled_at IS 'Timestamp for when the notification should be sent (for scheduled notifications)';

