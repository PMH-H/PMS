-- Pivot to Trigger-based approach to avoid RPC cache layout issues

-- 1. Create Trigger Function
CREATE OR REPLACE FUNCTION handle_staff_leave_facility()
RETURNS TRIGGER AS $$
DECLARE
    v_affected_assignments INT;
BEGIN
    -- Check if facility_id is changing from NOT NULL to NULL
    IF OLD.facility_id IS NOT NULL AND NEW.facility_id IS NULL THEN
        
        -- A. Deactivate Assignments
        WITH deactivated AS (
            UPDATE patient_pharmacist_assignments
            SET status = 'inactive', updated_at = NOW()
            WHERE pharmacist_id = OLD.id AND status = 'active'
            RETURNING id
        )
        SELECT count(*) INTO v_affected_assignments FROM deactivated;

        -- B. Audit Log
        INSERT INTO audit_log (action, details, performed_by)
        VALUES (
            'USER_LEFT_FACILITY',
            jsonb_build_object(
                'facility_id', OLD.facility_id, 
                'deactivated_assignments', v_affected_assignments,
                'method', 'profile_update_trigger'
            ),
            OLD.id -- The user performing the action (or being updated)
        );
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_staff_leave_facility ON profiles;

CREATE TRIGGER on_staff_leave_facility
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    WHEN (OLD.facility_id IS NOT NULL AND NEW.facility_id IS NULL)
    EXECUTE FUNCTION handle_staff_leave_facility();

-- 3. Ensure RLS allows user to update their own facility_id to NULL
-- (Usually users can update their own profile, but let's ensure specific column permission if strict)
-- We assume "Users can update own profile" policy exists. 
