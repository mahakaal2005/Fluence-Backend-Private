-- Add fluence_score field to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS fluence_score INTEGER DEFAULT 0;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_fluence_score ON users (fluence_score);

-- Add comment
COMMENT ON COLUMN users.fluence_score IS 'User fluence score displayed in the app. Points are awarded for various activities like connecting social accounts.';

