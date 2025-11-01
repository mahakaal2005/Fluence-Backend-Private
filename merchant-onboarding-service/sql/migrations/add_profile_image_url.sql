-- Migration: Add profile_image_url column to merchant_profiles table
-- Date: 2024
-- Description: Adds support for merchant profile images stored in Firebase Storage

-- Add profile_image_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'merchant_profiles' 
        AND column_name = 'profile_image_url'
    ) THEN
        ALTER TABLE merchant_profiles 
        ADD COLUMN profile_image_url TEXT;
        
        RAISE NOTICE 'Column profile_image_url added successfully';
    ELSE
        RAISE NOTICE 'Column profile_image_url already exists';
    END IF;
END $$;

