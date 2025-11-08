-- Update the trigger function to include instagram_id when creating merchant profile
CREATE OR REPLACE FUNCTION create_merchant_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if status changed to 'approved'
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    INSERT INTO merchant_profiles (
      application_id,
      user_id,
      business_name,
      business_type,
      contact_person,
      email,
      phone,
      business_address,
      business_license,
      tax_id,
      instagram_id,
      bank_account_details,
      approved_by
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.business_name,
      NEW.business_type,
      NEW.contact_person,
      NEW.email,
      NEW.phone,
      NEW.business_address,
      NEW.business_license,
      NEW.tax_id,
      NEW.instagram_id,
      NEW.bank_account_details,
      NEW.reviewed_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

