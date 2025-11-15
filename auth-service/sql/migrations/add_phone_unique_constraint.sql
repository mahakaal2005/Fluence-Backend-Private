-- Add unique constraint on phone column in users table
-- This ensures no two users can have the same phone number

-- First, remove any duplicate phone numbers (keep the oldest one)
DO $$
DECLARE
    duplicate_phone TEXT;
BEGIN
    FOR duplicate_phone IN 
        SELECT phone 
        FROM users 
        WHERE phone IS NOT NULL 
        GROUP BY phone 
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the oldest user, delete phone from others
        UPDATE users 
        SET phone = NULL 
        WHERE phone = duplicate_phone 
        AND id NOT IN (
            SELECT id 
            FROM users 
            WHERE phone = duplicate_phone 
            ORDER BY created_at ASC 
            LIMIT 1
        );
    END LOOP;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    -- Check if unique constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'users'::regclass 
        AND conname = 'users_phone_key'
    ) THEN
        -- Add unique constraint
        ALTER TABLE users 
        ADD CONSTRAINT users_phone_key UNIQUE (phone);
        
        RAISE NOTICE 'Unique constraint added on phone column';
    ELSE
        RAISE NOTICE 'Unique constraint on phone column already exists';
    END IF;
END $$;

-- Add comment
COMMENT ON CONSTRAINT users_phone_key ON users IS 'Ensures phone numbers are unique across all users';

