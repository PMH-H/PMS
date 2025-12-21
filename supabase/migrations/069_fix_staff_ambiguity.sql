-- Actually drop and recreate the function to fix ambiguity
-- (Since 067 was already applied, we need a new migration file to enforce changes)

DROP FUNCTION IF EXISTS get_admin_staff(UUID);

CREATE OR REPLACE FUNCTION get_admin_staff(p_admin_id UUID)
RETURNS TABLE (
    staff_id UUID,
    staff_name TEXT,
    staff_email TEXT,
    staff_role TEXT,
    patient_count BIGINT,
    prescriptions_today BIGINT,
    prescriptions_week BIGINT,
    last_active TIMESTAMPTZ
) AS $$
DECLARE
    v_facility_id UUID;
BEGIN
    SELECT facility_id INTO v_facility_id FROM profiles WHERE id = p_admin_id;
    
    RETURN QUERY
    SELECT 
        p.id AS staff_id,
        p.full_name AS staff_name,
        p.email AS staff_email,
        p.role::text AS staff_role,
        -- Use distinct alias to allow unambiguous reference
        (SELECT COUNT(DISTINCT ppa.patient_id) 
         FROM patient_pharmacist_assignments ppa 
         WHERE ppa.pharmacist_id = p.id AND ppa.status = 'active') AS patient_count,
        (SELECT COUNT(*) 
         FROM prescriptions pr 
         WHERE pr.approved_by = p.id AND pr.created_at > NOW() - INTERVAL '24 hours') AS prescriptions_today,
        (SELECT COUNT(*) 
         FROM prescriptions pr2 
         WHERE pr2.approved_by = p.id AND pr2.created_at > NOW() - INTERVAL '7 days') AS prescriptions_week,
        p.last_active_at AS last_active
    FROM profiles p
    WHERE p.facility_id = v_facility_id
    AND p.role::text IN ('pharmacist', 'worker', 'cashier')
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_staff(UUID) TO service_role;
