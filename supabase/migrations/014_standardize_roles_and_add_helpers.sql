-- Migration: 014_standardize_roles_and_add_helpers.sql
-- Description: Standardizes user roles to snake_case and adds the is_shop_member helper function.
-- NOTE: This migration drops ALL RLS policies temporarily to allow enum type change
-- =====================================================

-- 1. Create a new user_role enum with snake_case values
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
        CREATE TYPE user_role_new AS ENUM (
          'customer',
          'pharmacist',
          'worker',
          'cashier',
          'admin',
          'super_admin_bms',
          'super_admin_dev'
        );
    END IF;
END $$;

-- 2. Drop ALL RLS policies on ALL tables to allow enum type change
-- =====================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 3. Drop functions that depend on user_role type
-- =====================================================
DROP FUNCTION IF EXISTS get_user_role();
DROP FUNCTION IF EXISTS is_admin_or_above();
DROP FUNCTION IF EXISTS is_staff();
DROP FUNCTION IF EXISTS has_facility_access(UUID);
DROP FUNCTION IF EXISTS get_user_facility();

-- 4. Update the profiles table to use the new enum
-- =====================================================
-- Drop the default value
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;

-- Change the column type
ALTER TABLE profiles
ALTER COLUMN role TYPE user_role_new
USING (
  CASE role::text
    WHEN 'CUSTOMER' THEN 'customer'
    WHEN 'PHARMACIST' THEN 'pharmacist'
    WHEN 'WORKER' THEN 'worker'
    WHEN 'CASHIER' THEN 'cashier'
    WHEN 'ADMIN' THEN 'admin'
    WHEN 'SUPER_ADMIN_BMS' THEN 'super_admin_bms'
    WHEN 'SUPER_ADMIN_DEV' THEN 'super_admin_dev'
    ELSE 'customer'
  END::user_role_new
);

-- Restore the default value
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'customer'::user_role_new;

-- 5. Drop the old user_role enum and rename the new one
-- =====================================================
DROP TYPE IF EXISTS user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- 6. Recreate helper functions with new enum values
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_facility()
RETURNS UUID AS $$
  SELECT facility_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_facility_access(target_facility_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_facility UUID;
  user_role_val user_role;
BEGIN
  SELECT facility_id, role INTO user_facility, user_role_val 
  FROM profiles WHERE id = auth.uid();
  
  -- Super admins have access to all facilities
  IF user_role_val IN ('super_admin_bms', 'super_admin_dev') THEN
    RETURN TRUE;
  END IF;
  
  -- Check if target facility is user's facility or a descendant
  RETURN EXISTS (
    WITH RECURSIVE facility_tree AS (
      SELECT id, parent_id FROM facilities WHERE id = user_facility
      UNION ALL
      SELECT f.id, f.parent_id 
      FROM facilities f
      INNER JOIN facility_tree ft ON f.parent_id = ft.id
    )
    SELECT 1 FROM facility_tree WHERE id = target_facility_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin', 'super_admin_bms', 'super_admin_dev')
  FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT role != 'customer' FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- 7. Create the is_shop_member helper function
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

-- NOTE: All RLS policies will be recreated by migration 015_add_rls_policies.sql
