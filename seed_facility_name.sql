DO $$
DECLARE
    v_count INT;
BEGIN
    UPDATE facilities
    SET name = 'High Land pharmaceutical',
        address = '123 Main St, Lusaka',
        phone = '+260 97 000 0000', 
        email = 'admin@highland.com',
        updated_at = NOW()
    WHERE id IN (
        SELECT facility_id FROM profiles WHERE role = 'admin' AND facility_id IS NOT NULL
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Updated % facilities.', v_count;
END $$;
