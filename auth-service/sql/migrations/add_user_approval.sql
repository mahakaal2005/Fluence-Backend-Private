-- Add is_approved field to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users (is_approved);

-- Add comment
COMMENT ON COLUMN users.is_approved IS 'Whether the user has been approved by admin. Users must be approved and have Instagram connected to receive cashback points.';

