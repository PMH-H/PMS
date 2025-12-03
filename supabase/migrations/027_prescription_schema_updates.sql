-- Migration: 027_prescription_schema_updates.sql
-- Description: Add notes field and update RLS policies for prescription management

-- Add notes field for staff comments on prescriptions
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add approved_by field to track who approved/rejected
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

-- Add approved_at timestamp
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Update RLS policies for open viewing (as requested by user)
DROP POLICY IF EXISTS "Patients can view own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Staff can view all prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Patients can create own prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Staff can update prescriptions" ON prescriptions;

-- All authenticated users can view all prescriptions
CREATE POLICY "All authenticated users can view prescriptions" ON prescriptions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Patients can create their own prescriptions
CREATE POLICY "Patients can create own prescriptions" ON prescriptions
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Staff can create prescriptions for any patient
CREATE POLICY "Staff can create prescriptions for patients" ON prescriptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- Staff can update prescriptions (approve/reject/dispense)
CREATE POLICY "Staff can update prescriptions" ON prescriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);

-- Add index for patient_id lookups
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

-- Add index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_prescriptions_created ON prescriptions(created_at DESC);
