
-- QA Test: Store Flow (Persistent Log)
\x off

CREATE TABLE IF NOT EXISTS qa_results (
    id SERIAL PRIMARY KEY,
    test_name TEXT,
    result TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
        INSERT INTO qa_results (test_name, result, details) VALUES ('StoreFlow', 'SKIP', 'No valid item found');
        RETURN;
    END IF;

    -- 2. Action: Create a Sale (Qty: 2)
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

    -- 3. Verification: Check New Qty
    SELECT quantity INTO v_new_qty
    FROM inventory.item_batches
    WHERE id = v_batch_id;

    -- 4. Log Result
    IF v_new_qty = (v_old_qty - 2) THEN
        INSERT INTO qa_results (test_name, result, details) 
        VALUES ('StoreFlow', 'PASS', format('Stock deducted correctly. Old: %s, New: %s', v_old_qty, v_new_qty));
    ELSE
        INSERT INTO qa_results (test_name, result, details) 
        VALUES ('StoreFlow', 'FAIL', format('Stock mismatch. Expected: %s, Got: %s', v_old_qty - 2, v_new_qty));
    END IF;
END $$;
