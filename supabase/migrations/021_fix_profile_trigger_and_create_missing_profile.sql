-- Migration: 021_fix_profile_trigger_and_create_missing_profile.sql
-- Description: Fix the trigger to match actual schema and create missing profile

-- First, fix the trigger function to use correct schema
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'CUSTOMER',
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now create the missing profile for the existing user
-- This will only insert if the profile doesn't exist
INSERT INTO profiles (id, role, full_name)
VALUES (
  'f4d67f41-3b55-4c2d-b7ed-9d80fda4e514',
  'CUSTOMER',
  'Mambwe Mwila'
)
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name;
