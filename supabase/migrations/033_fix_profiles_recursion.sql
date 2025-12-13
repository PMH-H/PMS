-- Migration: 033_fix_profiles_recursion.sql
-- Description: Fix infinite recursion in profiles RLS by using a SECURITY DEFINER function

-- 1. Create a secure function to check if user is staff
-- SECURITY DEFINER means this function runs with the privileges of the creator (superuser),
-- bypassing RLS on the 'profiles' table to avoid the infinite loop.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Staff view all profiles" ON profiles;

-- 3. Re-create the policy using the secure function
CREATE POLICY "Staff view all profiles" ON profiles
  FOR SELECT USING (
    public.is_staff()
  );

-- 4. Ensure patients can still see staff profiles (no recursion here as it checks the row being accessed, not the user's own row)
-- (This policy from 032 is fine: role IN ('pharmacist', 'admin'))
