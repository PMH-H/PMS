
-- qa_hierarchy.sql
-- Purpose: Verify Multi-tenant Inventory Logic

BEGIN;

-- 1. Setup Test Data
DO $$
DECLARE
    v_parent_id UUID;
    v_child_id UUID;
    v_item_id UUID;
    v_batch_id UUID;
    v_user_id UUID;
    v_inv_record RECORD;
BEGIN
    RAISE NOTICE '--- STARTING HIERARCHY TEST ---';

    -- Get a valid user
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    -- Create Parent Facility
    INSERT INTO public.facilities (name, region, type, status)
    VALUES ('QA District Hospital', 'Lusaka', 'DISTRICT_HOSPITAL', 'ACTIVE')
    RETURNING id INTO v_parent_id;
    
    -- Create Child Facility
    INSERT INTO public.facilities (name, region, type, status, parent_facility_id)
    VALUES ('QA Remote Clinic', 'Lusaka', 'CLINIC', 'ACTIVE', v_parent_id)
    RETURNING id INTO v_child_id;

    RAISE NOTICE 'Created Facilities: Parent %, Child %', v_parent_id, v_child_id;

    -- Create/Get an Item
    INSERT INTO inventory.items (name, description, category, unit)
    VALUES ('QA Test Drug', 'Hierarchy Test', 'Medicine', 'Box')
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO v_item_id FROM inventory.items WHERE name = 'QA Test Drug' LIMIT 1;

    -- Add Stock to CHILD (100 units)
    INSERT INTO inventory.item_batches (item_id, facility_id, batch_number, expiry_date, current_quantity, unit_cost)
    VALUES (v_item_id, v_child_id, 'BATCH-CHILD-01', CURRENT_DATE + 365, 100, 10.00)
    RETURNING id INTO v_batch_id;

    RAISE NOTICE 'Added 100 units to Child Facility';

    -- 2. Test Network View (Should see 100 units from Parent)
    RAISE NOTICE 'Testing get_network_inventory...';
    
    SELECT * INTO v_inv_record FROM public.get_network_inventory(v_parent_id) WHERE item_id = v_item_id;
    
    IF v_inv_record.total_quantity = 100 THEN
        RAISE NOTICE 'SUCCESS: Parent sees Child stock correctly.';
    ELSE
        RAISE EXCEPTION 'FAILURE: Expected 100 units, got %', v_inv_record.total_quantity;
    END IF;

    -- 3. Test Transfer (Child -> Parent for reverse logistics, or Parent -> Child)
    -- Let's Transfer 20 units from Child to Parent (e.g. recall)
    RAISE NOTICE 'Testing transfer_stock (Child to Parent)...';
    
    PERFORM public.transfer_stock(v_child_id, v_parent_id, v_item_id, 20, v_user_id);
    
    -- Verify Deductions
    DECLARE
        v_child_qty INTEGER;
        v_parent_qty INTEGER;
    BEGIN
        SELECT SUM(current_quantity) INTO v_child_qty FROM inventory.item_batches WHERE facility_id = v_child_id AND item_id = v_item_id;
        SELECT SUM(current_quantity) INTO v_parent_qty FROM inventory.item_batches WHERE facility_id = v_parent_id AND item_id = v_item_id;
        
        RAISE NOTICE 'Post-Transfer: Child %, Parent %', v_child_qty, v_parent_qty;
        
        IF v_child_qty = 80 AND v_parent_qty = 20 THEN
            RAISE NOTICE 'SUCCESS: Stock Transfer verified.';
        ELSE
            RAISE EXCEPTION 'FAILURE: Transfer math mismatch.';
        END IF;
    END;

    RAISE NOTICE '--- HIERARCHY TEST COMPLETE ---';
    
    -- Cleanup (Rollback to keep DB clean)
    RAISE EXCEPTION 'Test Complete (Rollback Triggered)';

EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Test Complete%' THEN
        RAISE NOTICE '%', SQLERRM;
    ELSE
        RAISE NOTICE 'ERROR: %', SQLERRM;
        RAISE; -- Re-raise real errors
    END IF;
END $$;

ROLLBACK;
