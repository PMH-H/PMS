-- Create RLS policies for item_batches (without dropping first)
-- This ensures policies are created even if they don't exist

-- Allow pharmacists to INSERT batches
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'item_batches' 
        AND policyname = 'Pharmacists can create batches'
    ) THEN
        CREATE POLICY "Pharmacists can create batches" ON item_batches
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid()
                    AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
                )
            );
    END IF;
END $$;

-- Allow pharmacists to UPDATE batches
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'item_batches' 
        AND policyname = 'Pharmacists can update batches'
    ) THEN
        CREATE POLICY "Pharmacists can update batches" ON item_batches
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid()
                    AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
                )
            );
    END IF;
END $$;
