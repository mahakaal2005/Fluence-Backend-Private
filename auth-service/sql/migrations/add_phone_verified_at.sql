-- Add phone_verified_at column to users table
-- This column tracks when a user's phone number was verified via OTP

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Add index for faster lookups on phone verification status
CREATE INDEX IF NOT EXISTS idx_users_phone_verified_at ON users (phone_verified_at);

-- Add comment for documentation
COMMENT ON COLUMN users.phone_verified_at IS 'Timestamp when the user verified their phone number via OTP. NULL if phone is not verified.';


