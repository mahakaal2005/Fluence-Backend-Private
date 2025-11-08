-- Add instagram_id field to merchant_applications table
ALTER TABLE merchant_applications 
ADD COLUMN IF NOT EXISTS instagram_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_merchant_applications_instagram_id ON merchant_applications (instagram_id);

-- Add comment
COMMENT ON COLUMN merchant_applications.instagram_id IS 'Instagram username/handle for merchant tagging (without @)';

