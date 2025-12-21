-- Re-apply get_admin_staff function in case it was missed or permissions were wrong
CREATE OR REPLACE FUNCTION get_admin_staff(p_admin_id UUID)
RETURNS TABLE (
    pharmacist_id UUID,
    pharmacist_name TEXT,
    pharmacist_email TEXT,
    role TEXT,
    patient_count BIGINT,
    prescriptions_today BIGINT,
    prescriptions_week BIGINT,
    last_active TIMESTAMPTZ
) AS $$
DECLARE
    v_facility_id UUID;
BEGIN
    -- Get admin's facility
    SELECT facility_id INTO v_facility_id FROM profiles WHERE id = p_admin_id;
    
    RETURN QUERY
    SELECT 
        p.id AS pharmacist_id,
        p.full_name AS pharmacist_name,
        p.email AS pharmacist_email,
        p.role::text AS role,
        (SELECT COUNT(DISTINCT patient_id) FROM patient_pharmacist_assignments WHERE pharmacist_id = p.id AND status = 'active') AS patient_count,
        (SELECT COUNT(*) FROM prescriptions WHERE approved_by = p.id AND created_at > NOW() - INTERVAL '24 hours') AS prescriptions_today,
        (SELECT COUNT(*) FROM prescriptions WHERE approved_by = p.id AND created_at > NOW() - INTERVAL '7 days') AS prescriptions_week,
        p.last_active_at AS last_active
    FROM profiles p
    WHERE p.facility_id = v_facility_id
    AND p.role::text IN ('pharmacist', 'worker', 'cashier')
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions (Crucial for PostgREST/Supabase RPC)
GRANT EXECUTE ON FUNCTION get_admin_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_staff(UUID) TO service_role;

-- Also check get_pharmacist_patients just in case
-- GRANT EXECUTE ON FUNCTION get_pharmacist_patients(UUID) TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_pharmacist_patients(UUID) TO service_role;
