
-- QA Test: Store Flow (Stock Deduction)
\x off

DO $$
DECLARE
    v_facility_id UUID;
    v_item_id UUID;
    v_batch_id UUID;
    v_old_qty INT;
    v_new_qty INT;
    v_sale_id UUID;
BEGIN
    -- 1. Setup: Get a valid Item and its Batch
    SELECT i.id, i.facility_id, ib.id, ib.quantity 
    INTO v_item_id, v_facility_id, v_batch_id, v_old_qty
    FROM inventory.items i
    JOIN inventory.item_batches ib ON i.id = ib.item_id
    WHERE ib.quantity > 5
    LIMIT 1;

    IF v_item_id IS NULL THEN
        RAISE NOTICE 'No valid item found for test.';
        RETURN;
    END IF;

    RAISE NOTICE 'Test Item: %, Batch: %, Old Qty: %', v_item_id, v_batch_id, v_old_qty;

    -- 2. Action: Create a Sale (Qty: 2)
    -- Note: The trigger expects 'items' jsonb array with {item_id, quantity, unit_price}
    INSERT INTO commerce.sales (facility_id, total_amount, payment_method, items)
    VALUES (
        v_facility_id, 
        100, 
        'CASH',
        jsonb_build_array(
            jsonb_build_object(
                'item_id', v_item_id,
                'quantity', 2,
                'unit_price', 50,
                'name', 'QA Test Item'
            )
        )
    )
    RETURNING id INTO v_sale_id;

    RAISE NOTICE 'Sale Created: %', v_sale_id;

    -- 3. Verification: Check New Qty
    SELECT quantity INTO v_new_qty
    FROM inventory.item_batches
    WHERE id = v_batch_id;

    RAISE NOTICE 'New Qty: %', v_new_qty;

    -- 4. Assertion
    IF v_new_qty = (v_old_qty - 2) THEN
        RAISE EXCEPTION 'SUCCESS: Stock deducted correctly (Delta: 2). Aborting to rollback.';
    ELSE
        RAISE EXCEPTION 'FAILURE: Stock mismatch. Expected %, Got %', (v_old_qty - 2), v_new_qty;
    END IF;

    -- Optional: Rollback if we don't want to pollute DB? 
    -- For QA, let's keep it to prove it works, or rollback to be clean.
    -- Let's rollback to keep environment clean.
    -- ROLLBACK; -- Cannot rollback inside DO block easily in simple query mode without transaction control.
    -- We'll just leave it and note it.
END $$;
