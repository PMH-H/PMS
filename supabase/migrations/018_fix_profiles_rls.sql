-- Migration: 018_fix_profiles_rls.sql
-- Description: Allow authenticated users to insert their own profile row.
-- This is necessary when the automatic trigger fails or for self-healing logic in the frontend.

-- Drop existing policy if it exists (to be safe/idempotent)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create policy to allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
    ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
