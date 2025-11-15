-- Add email_verified_at column to users table
-- This column tracks when a user's email address was verified

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Add index for faster lookups on email verification status
CREATE INDEX IF NOT EXISTS idx_users_email_verified_at ON users (email_verified_at);

-- Add comment for documentation
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when the user verified their email address. NULL if email is not verified.';

