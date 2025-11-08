-- Fix is_approved field default value and existing data
-- Problem: Default was 'false', making all users appear rejected
-- Solution: Change default to NULL and update existing users

-- Step 1: Update all existing users with is_approved=false to NULL
-- (These users were never explicitly rejected, they just have the default false value)
UPDATE users 
SET is_approved = NULL 
WHERE is_approved = false 
  AND id NOT IN (
    -- Keep is_approved=false only for explicitly approved/rejected users
    -- This assumes no audit trail, so we update all to NULL for safety
    SELECT id FROM users WHERE 1=0
  );

-- Step 2: Change the column default from false to NULL
ALTER TABLE users 
ALTER COLUMN is_approved SET DEFAULT NULL;

-- Step 3: Update the comment to reflect the new logic
COMMENT ON COLUMN users.is_approved IS 'User approval status: NULL = pending/not reviewed, true = approved by admin, false = rejected by admin. Users must be approved and have Instagram connected to receive cashback points.';

-- Verification query (run this to check the fix worked)
-- SELECT 
--   is_approved,
--   COUNT(*) as user_count,
--   CASE 
--     WHEN is_approved IS NULL THEN 'Pending (awaiting review)'
--     WHEN is_approved = true THEN 'Approved'
--     WHEN is_approved = false THEN 'Rejected'
--   END as status_meaning
-- FROM users
-- GROUP BY is_approved
-- ORDER BY is_approved NULLS FIRST;

