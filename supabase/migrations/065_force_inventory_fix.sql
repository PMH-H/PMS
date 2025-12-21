-- Migration to FORCE fix orphaned inventory
-- Aggressively links ALL batches to the most recent facility.

DO $$
DECLARE
    v_facility_id UUID;
    v_count INT;
BEGIN
    -- Get most recent facility
    SELECT id INTO v_facility_id FROM facilities ORDER BY created_at DESC LIMIT 1;

    IF v_facility_id IS NOT NULL THEN
        RAISE NOTICE 'Targeting Facility: %', v_facility_id;

        -- Update Batches
        UPDATE item_batches 
        SET facility_id = v_facility_id;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Linked % batches.', v_count;

        -- Update Alerts
        UPDATE alerts
        SET facility_id = v_facility_id;
        
        -- Update Sales
        UPDATE sales
        SET facility_id = v_facility_id;
        
    ELSE
        RAISE WARNING 'No facilities found at all.';
    END IF;
END $$;
