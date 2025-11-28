-- Migration: 014_standardize_roles_and_add_helpers.sql
-- Description: Standardizes user roles to snake_case and adds the is_shop_member helper function.
-- =====================================================

-- 1. Create a new user_role enum with snake_case values
-- =====================================================
CREATE TYPE user_role_new AS ENUM (
  'customer',
  'pharmacist',
  'worker',
  'cashier',
  'admin',
  'super_admin_bms',
  'super_admin_dev'
);

-- 2. Update the profiles table to use the new enum
-- =====================================================
ALTER TABLE profiles
ALTER COLUMN role TYPE user_role_new
USING (role::text::user_role_new);

-- 3. Drop the old user_role enum and rename the new one
-- =====================================================
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- 4. Create the is_shop_member helper function
-- =====================================================
CREATE OR REPLACE FUNCTION is_shop_member(user_id UUID, facility_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_id
    AND profiles.facility_id = facility_id
    AND profiles.role IN ('pharmacist', 'worker', 'cashier', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;
