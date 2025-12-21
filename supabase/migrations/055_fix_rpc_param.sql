-- Drop the old function to clean up
DROP FUNCTION IF EXISTS link_staff_to_facility(TEXT);

-- Recreate with a Distinct parameter name
CREATE OR REPLACE FUNCTION link_staff_to_facility(
    target_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_facility UUID;
    v_target_user_id UUID;
    v_target_user_facility UUID;
    v_target_role TEXT;
BEGIN
    -- 1. Get calling admin's facility
    SELECT facility_id INTO v_admin_facility
    FROM profiles
    WHERE id = auth.uid() AND role = 'admin';

    IF v_admin_facility IS NULL THEN
        RAISE EXCEPTION 'Caller is not an admin or has no facility assigned.';
    END IF;

    -- 2. Find target user by email
    SELECT id, facility_id, role::text INTO v_target_user_id, v_target_user_facility, v_target_role
    FROM profiles
    WHERE email = target_email;

    IF v_target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found.', target_email;
    END IF;

    -- 3. Check constraints
    IF v_target_user_facility IS NOT NULL THEN
        RAISE EXCEPTION 'User is already linked to a facility.';
    END IF;

    IF v_target_role NOT IN ('pharmacist', 'worker', 'cashier') THEN
        RAISE EXCEPTION 'Only pharmacists, workers, and cashiers can be linked as staff.';
    END IF;

    -- 4. Update the user
    UPDATE profiles
    SET facility_id = v_admin_facility, updated_at = NOW()
    WHERE id = v_target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_target_user_id,
        'message', 'Staff member linked successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicit permissions
GRANT EXECUTE ON FUNCTION link_staff_to_facility(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION link_staff_to_facility(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION link_staff_to_facility(TEXT) TO public;
