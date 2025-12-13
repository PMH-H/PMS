-- Migration: 030_add_prescription_indexes.sql
-- Description: Add indexes to prescriptions table for better query performance

-- Index for patient lookups
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);

-- Index for date sorting
CREATE INDEX IF NOT EXISTS idx_prescriptions_created ON prescriptions(created_at DESC);

-- Index for verified prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_verified ON prescriptions(verified_by) WHERE verified_by IS NOT NULL;

-- Index for approved prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_approved ON prescriptions(approved_by) WHERE approved_by IS NOT NULL;

-- Composite index for common queries (patient + status)
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_status ON prescriptions(patient_id, status);
