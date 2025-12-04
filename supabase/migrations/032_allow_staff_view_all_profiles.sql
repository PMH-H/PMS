-- Migration: 032_allow_staff_view_all_profiles.sql
-- Description: Allow pharmacists and admins to view all user profiles (needed for open prescription routing)

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can view facility profiles" ON profiles;

-- 1. Users can view their own profile
CREATE POLICY "Users view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. Staff (Pharmacists, Admins, Super Admins) can view ALL profiles
-- This is critical for:
--   a) Seeing patient details for incoming prescriptions (from any patient)
--   b) Searching for patients
--   c) Chatting with any patient
CREATE POLICY "Staff view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- 3. Patients can view Pharmacist profiles (for chat/info)
CREATE POLICY "Patients view staff profiles" ON profiles
  FOR SELECT USING (
    role IN ('pharmacist', 'admin')
  );

-- 4. Allow users to update their own profile
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
