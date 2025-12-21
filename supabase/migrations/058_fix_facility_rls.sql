-- Ensure facilities are readable by authenticated users (for dashboard display)
-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Authenticated users can view facilities" ON facilities;
DROP POLICY IF EXISTS "Public can view active facilities" ON facilities;

-- Create permissive policy for reading facility names
CREATE POLICY "Authenticated users can view facilities"
    ON facilities
    FOR SELECT
    TO authenticated
    USING (true); -- Allow reading all facilities (needed for join search & displaying linked facility)

-- Ensure the leave_facility RPC works by ensuring profile update is allowed?
-- No, RPC is SECURITY DEFINER so it bypasses RLS. We are good there.
