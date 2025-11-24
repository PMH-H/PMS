-- Fix schema alignment issues between frontend and database

-- 1. Add image columns that match frontend expectations
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_front TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_back TEXT;

-- 2. Add price_estimate column (already in migration 005 but ensuring it exists)
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_estimate NUMERIC(10,2);

-- 3. Ensure default_unit exists (migration 005 should have done this)
-- If migration 005 didn't run, this will fail safely
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'default_unit'
    ) THEN
        ALTER TABLE items RENAME COLUMN unit TO default_unit;
    END IF;
END $$;

-- 4. Fix RLS policies for item_batches to allow pharmacists to insert
DROP POLICY IF EXISTS "Pharmacists can create batches" ON item_batches;
CREATE POLICY "Pharmacists can create batches" ON item_batches
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );

-- 5. Ensure pharmacists can update batches
DROP POLICY IF EXISTS "Pharmacists can update batches" ON item_batches;
CREATE POLICY "Pharmacists can update batches" ON item_batches
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
        )
    );
