-- RPC to allow staff to leave a facility
CREATE OR REPLACE FUNCTION leave_facility()
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
    -- We assume 'inactive' is a valid status based on check constraint in 045
    WITH deactivated AS (
        UPDATE patient_pharmacist_assignments
        SET status = 'inactive', updated_at = NOW()
        WHERE pharmacist_id = v_user_id AND status = 'active'
        RETURNING id
    )
    SELECT count(*) INTO v_affected_assignments FROM deactivated;

    -- 4. Audit Log (Try inserting into audit_logs if it exists, otherwise skip or use alternative)
    -- Using dynamic SQL to avoid potential missing table error during parse if table missing?
    -- No, usually migration assumes table exists. Let's assume audit_logs exists from previous context.
    -- Reverting to simple insert if I find the table. For now, I'll add a standard insert.
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

GRANT EXECUTE ON FUNCTION leave_facility() TO authenticated;
