-- Migration: 029_add_prescription_manual_entry.sql
-- Description: Add field for manual prescription entry when AI fails

-- Add manual_entry field for staff to manually enter prescription details
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS manual_entry TEXT;

-- Add comment
COMMENT ON COLUMN prescriptions.manual_entry IS 'Manual prescription details entered by staff when AI parsing fails';
