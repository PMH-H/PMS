-- Drop old attempts
DROP FUNCTION IF EXISTS leave_facility();

-- New function name to bypass cache
CREATE OR REPLACE FUNCTION staff_leave_current_facility()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_old_facility_id UUID;
    v_affected_assignments INT;
BEGIN
    v_user_id := auth.uid();

    -- 1. Get current facility
    SELECT facility_id INTO v_old_facility_id
    FROM profiles
    WHERE id = v_user_id;

    IF v_old_facility_id IS NULL THEN
        RAISE EXCEPTION 'You are not linked to any facility.';
    END IF;

    -- 2. Unlink user
    UPDATE profiles
    SET facility_id = NULL, updated_at = NOW()
    WHERE id = v_user_id;

    -- 3. Deactivate patient assignments
    WITH deactivated AS (
        UPDATE patient_pharmacist_assignments
        SET status = 'inactive', updated_at = NOW()
        WHERE pharmacist_id = v_user_id AND status = 'active'
        RETURNING id
    )
    SELECT count(*) INTO v_affected_assignments FROM deactivated;

    -- 4. Audit Log
    -- We successfully confirmed 'audit_log' (singular) is the table name in previous steps
    INSERT INTO audit_log (action, details, performed_by)
    VALUES (
        'USER_LEFT_FACILITY',
        jsonb_build_object('facility_id', v_old_facility_id, 'deactivated_assignments', v_affected_assignments),
        v_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully left facility.',
        'assignments_deactivated', v_affected_assignments
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION staff_leave_current_facility() TO authenticated;
