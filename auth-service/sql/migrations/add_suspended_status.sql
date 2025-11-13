-- Add 'suspended' status to users table status CHECK constraint
-- Problem: Admin panel couldn't suspend users - database constraint didn't support 'suspended' status
-- Solution: Update the CHECK constraint to include 'suspended' as a valid status value

-- Step 1: Drop the existing CHECK constraint
-- Note: PostgreSQL auto-generates constraint names, so we need to find and drop it
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name for the status column CHECK constraint
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%IN%'
    LIMIT 1;
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No existing status constraint found, will create new one';
    END IF;
END $$;

-- Step 2: Drop the constraint if it already exists (in case of re-run)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Step 3: Add the new CHECK constraint with 'suspended' included
ALTER TABLE users
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'paused', 'deleted', 'flagged', 'suspended'));

-- Step 4: Update the column comment to reflect the new status values
COMMENT ON COLUMN users.status IS 'User account status: active (normal), paused (temporarily disabled), suspended (admin action), deleted (soft delete), flagged (requires review)';

-- Verification query (run this to check the fix worked)
-- SELECT 
--   status,
--   COUNT(*) as user_count
-- FROM users
-- GROUP BY status
-- ORDER BY status;

