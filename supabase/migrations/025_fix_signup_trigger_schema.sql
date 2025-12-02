-- Migration: 025_fix_signup_trigger_schema.sql
-- Description: Fix the signup trigger to explicitly use 'public.profiles' to avoid "relation does not exist" errors.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create minimal profile with just email-derived name
  -- User can complete profile later
  -- EXPLICITLY specify 'public.profiles' to avoid schema search path issues in Auth context
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id, 
    'customer', -- Default to customer/patient
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
