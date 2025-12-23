DO $$
DECLARE
    v_user_id UUID;
    v_facility_id UUID;
    v_updated INT;
BEGIN
    -- 1. Find User
    SELECT id, facility_id INTO v_user_id, v_facility_id
    FROM profiles
    WHERE full_name ILIKE '%High Lord%'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User "High Lord" not found!';
        RETURN;
    END IF;

    IF v_facility_id IS NULL THEN
        RAISE NOTICE 'User "High Lord" belongs to no facility. Cannot update name.';
        RETURN;
    END IF;

    -- 2. Update Facility
    UPDATE facilities
    SET name = 'High Land pharmaceutical',
        address = '123 Main St, Lusaka',
        phone = '+260 97 000 0000',
        email = 'admin@highland.com',
        updated_at = NOW()
    WHERE id = v_facility_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RAISE NOTICE 'Success! User % (Facility %) Name updated. Rows affected: %', v_user_id, v_facility_id, v_updated;
END $$;
