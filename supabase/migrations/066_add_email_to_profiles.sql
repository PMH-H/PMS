-- Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create a function to sync email from auth.users (Backfill + Trigger)
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users update
DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email();

-- Also trigger on insert? 
-- Usually handle_new_user handles insert, but let's make sure handle_new_user maps email too.

-- Update handle_new_user to include email if not already
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CUSTOMER'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing profiles
DO $$
BEGIN
    UPDATE profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND p.email IS NULL;
END $$;
