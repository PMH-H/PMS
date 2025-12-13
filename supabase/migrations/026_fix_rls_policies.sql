-- Migration: 026_fix_rls_policies.sql
-- Description: Fix RLS policies for audit_log and prescriptions to allow proper data flow.

-- =====================================================
-- 1. AUDIT LOG POLICIES
-- =====================================================
-- Problem: Triggers try to insert into audit_log, but users don't have permission.
-- Solution: Allow authenticated users to INSERT into audit_log.
-- Note: We still restrict SELECT/UPDATE/DELETE to admins/devs.

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to create audit log entries (via triggers)
CREATE POLICY "Authenticated users can insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only admins/devs can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_log
  FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin_bms', 'super_admin_dev')
  )
);

-- =====================================================
-- 2. PRESCRIPTION POLICIES
-- =====================================================
-- Problem: Patients getting 403 when creating prescriptions.
-- Solution: Ensure the INSERT policy is correct and covers the use case.

-- Drop existing insert policy to be safe and recreate it
DROP POLICY IF EXISTS "Patients can create own prescriptions" ON prescriptions;

CREATE POLICY "Patients can create own prescriptions" ON prescriptions
  FOR INSERT WITH CHECK (
    auth.uid() = patient_id
  );

-- Ensure update policy is correct for status updates by pharmacists
DROP POLICY IF EXISTS "Staff can update prescriptions" ON prescriptions;

CREATE POLICY "Staff can update prescriptions" ON prescriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
  );
