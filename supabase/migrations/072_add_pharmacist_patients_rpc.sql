-- Create get_pharmacist_patients function
CREATE OR REPLACE FUNCTION get_pharmacist_patients(p_pharmacist_id UUID)
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    patient_email TEXT,
    total_prescriptions BIGINT,
    last_prescription TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS patient_id,
        p.full_name AS patient_name,
        p.email AS patient_email,
        COUNT(rx.id) AS total_prescriptions,
        MAX(rx.created_at) AS last_prescription,
        MIN(rx.created_at) AS assigned_at,
        FALSE AS is_primary
    FROM profiles p
    JOIN prescriptions rx ON rx.patient_id = p.id
    WHERE rx.approved_by = p_pharmacist_id
    GROUP BY p.id, p.full_name, p.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pharmacist_patients(UUID) TO authenticated;
