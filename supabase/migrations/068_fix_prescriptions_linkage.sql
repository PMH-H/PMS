-- Migration to link Prescriptions to Facility and Fix Schema Cache
-- 1. Add facility_id to prescriptions if missing
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id);

-- 2. Force link ALL existing prescriptions to the most recent facility (Fix orphaned data)
DO $$
DECLARE
    v_facility_id UUID;
    v_count INT;
BEGIN
    SELECT id INTO v_facility_id FROM facilities ORDER BY created_at DESC LIMIT 1;
    
    IF v_facility_id IS NOT NULL THEN
        UPDATE prescriptions 
        SET facility_id = v_facility_id;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Linked % prescriptions to facility %', v_count, v_facility_id;
    END IF;
END $$;

-- 3. Force PostgREST schema cache reload to fix RPC 400 error
NOTIFY pgrst, 'reload schema';
