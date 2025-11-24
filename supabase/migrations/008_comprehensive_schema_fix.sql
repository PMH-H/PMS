-- Comprehensive fix for all schema mismatches and RLS policies

-- =====================================================
-- 1. FIX AUDIT_LOG TABLE
-- =====================================================

-- Add columns that frontend expects
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS resource_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS payload JSONB;

-- Update existing data if any
UPDATE audit_log SET 
    resource_type = table_name,
    resource_id = record_id,
    payload = COALESCE(new_data, previous_data)
WHERE resource_type IS NULL;

-- =====================================================
-- 2. FIX ITEM_BATCHES COLUMN NAMES
-- =====================================================

-- Add columns with frontend-expected names
ALTER TABLE item_batches ADD COLUMN IF NOT EXISTS received_units INTEGER;
ALTER TABLE item_batches ADD COLUMN IF NOT EXISTS current_units INTEGER;
ALTER TABLE item_batches ADD COLUMN IF NOT EXISTS drug_id UUID;

-- Copy data from old columns to new ones
UPDATE item_batches SET 
    received_units = received_quantity,
    current_units = current_quantity,
    drug_id = item_id
WHERE received_units IS NULL;

-- =====================================================
-- 3. FIX RLS POLICIES FOR ITEM_BATCHES
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE item_batches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pharmacists can create batches" ON item_batches;
DROP POLICY IF EXISTS "Pharmacists can update batches" ON item_batches;
DROP POLICY IF EXISTS "Pharmacists can read batches" ON item_batches;

-- Create comprehensive RLS policies

-- Allow pharmacists to INSERT batches
CREATE POLICY "Pharmacists can create batches" ON item_batches
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'CASHIER', 'WORKER', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- Allow pharmacists to READ batches
CREATE POLICY "Pharmacists can read batches" ON item_batches
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'CASHIER', 'WORKER', 'CUSTOMER', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- Allow pharmacists to UPDATE batches
CREATE POLICY "Pharmacists can update batches" ON item_batches
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'CASHIER', 'WORKER', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- Allow pharmacists to DELETE batches
CREATE POLICY "Pharmacists can delete batches" ON item_batches
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- =====================================================
-- 4. FIX RLS POLICIES FOR AUDIT_LOG
-- =====================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can insert audit logs" ON audit_log;
DROP POLICY IF EXISTS "Staff can read audit logs" ON audit_log;

-- Allow all authenticated users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs" ON audit_log
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Allow staff to read audit logs
CREATE POLICY "Staff can read audit logs" ON audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );
