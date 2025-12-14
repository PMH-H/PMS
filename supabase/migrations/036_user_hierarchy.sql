-- =====================================================================
-- Migration 036: User Hierarchy & Role-Based Metrics
-- Establishes relationships: Patient ↔ Pharmacist (M:M), 
-- Pharmacist → Admin (M:1), and creates role-specific metrics views
-- =====================================================================

-- 1. Patient-Pharmacist Assignments (Many-to-Many relationship)
-- Tracks which patients are assigned to which pharmacists
CREATE TABLE IF NOT EXISTS patient_pharmacist_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pharmacist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES profiles(id),
    is_primary BOOLEAN DEFAULT false, -- Primary pharmacist for the patient
    status TEXT CHECK (status IN ('active', 'inactive', 'transferred')) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(patient_id, pharmacist_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ppa_patient ON patient_pharmacist_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_ppa_pharmacist ON patient_pharmacist_assignments(pharmacist_id);
CREATE INDEX IF NOT EXISTS idx_ppa_facility ON patient_pharmacist_assignments(facility_id);
CREATE INDEX IF NOT EXISTS idx_ppa_status ON patient_pharmacist_assignments(status);

-- 2. Add manager relationship to profiles (Admin manages Pharmacists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager ON profiles(manager_id);

-- 3. RLS Policies for patient_pharmacist_assignments

ALTER TABLE patient_pharmacist_assignments ENABLE ROW LEVEL SECURITY;

-- Patients can view their own assignments
DROP POLICY IF EXISTS "Patients view own assignments" ON patient_pharmacist_assignments;
CREATE POLICY "Patients view own assignments" ON patient_pharmacist_assignments
    FOR SELECT USING (patient_id = auth.uid());

-- Pharmacists can view their patient assignments
DROP POLICY IF EXISTS "Pharmacists view their assignments" ON patient_pharmacist_assignments;
CREATE POLICY "Pharmacists view their assignments" ON patient_pharmacist_assignments
    FOR SELECT USING (pharmacist_id = auth.uid());

-- Staff can manage assignments in their facility
DROP POLICY IF EXISTS "Staff manage facility assignments" ON patient_pharmacist_assignments;
CREATE POLICY "Staff manage facility assignments" ON patient_pharmacist_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role::text IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
            AND (facility_id = patient_pharmacist_assignments.facility_id OR role::text IN ('super_admin_bms', 'super_admin_dev'))
        )
    );

-- 4. Pharmacist Metrics Summary View
-- Aggregates metrics for each pharmacist
CREATE OR REPLACE VIEW pharmacist_metrics_summary AS
SELECT 
    p.id AS pharmacist_id,
    p.full_name AS pharmacist_name,
    p.facility_id,
    f.name AS facility_name,
    
    -- Patient counts
    (SELECT COUNT(DISTINCT patient_id) 
     FROM patient_pharmacist_assignments 
     WHERE pharmacist_id = p.id AND status = 'active') AS active_patients,
    
    -- Prescription counts (approved_by is UUID)
    (SELECT COUNT(*) FROM prescriptions 
     WHERE approved_by = p.id) AS total_prescriptions_processed,
    
    (SELECT COUNT(*) FROM prescriptions 
     WHERE approved_by = p.id 
     AND created_at > NOW() - INTERVAL '24 hours') AS prescriptions_today,
    
    (SELECT COUNT(*) FROM prescriptions 
     WHERE approved_by = p.id 
     AND created_at > NOW() - INTERVAL '7 days') AS prescriptions_week,
    
    -- Status breakdown
    (SELECT COUNT(*) FROM prescriptions 
     WHERE approved_by = p.id 
     AND status = 'APPROVED') AS approved_count,
    
    (SELECT COUNT(*) FROM prescriptions 
     WHERE approved_by = p.id 
     AND status = 'REJECTED') AS rejected_count,
    
    -- Activity
    p.last_active_at,
    p.created_at AS joined_at
    
FROM profiles p
LEFT JOIN facilities f ON p.facility_id = f.id
WHERE p.role::text IN ('pharmacist', 'worker', 'cashier');

COMMENT ON VIEW pharmacist_metrics_summary IS 'Aggregated performance metrics for each pharmacist';

-- 5. Admin (Shop Owner) Metrics Summary View
-- Aggregates metrics for shop admins across their staff
CREATE OR REPLACE VIEW admin_metrics_summary AS
SELECT 
    a.id AS admin_id,
    a.full_name AS admin_name,
    a.facility_id,
    f.name AS facility_name,
    
    -- Staff counts
    (SELECT COUNT(*) FROM profiles 
     WHERE facility_id = a.facility_id 
     AND role::text IN ('pharmacist', 'worker', 'cashier')) AS total_pharmacists,
    
    (SELECT COUNT(*) FROM profiles 
     WHERE facility_id = a.facility_id 
     AND role::text IN ('pharmacist', 'worker', 'cashier')
     AND last_active_at > NOW() - INTERVAL '24 hours') AS active_pharmacists_today,
    
    -- Customer counts
    (SELECT COUNT(DISTINCT patient_id) 
     FROM patient_pharmacist_assignments ppa
     JOIN profiles ph ON ppa.pharmacist_id = ph.id
     WHERE ph.facility_id = a.facility_id 
     AND ppa.status = 'active') AS total_patients,
    
    -- Prescription metrics (facility-wide) - approved_by is UUID
    (SELECT COUNT(*) FROM prescriptions pr
     JOIN profiles ph ON pr.approved_by = ph.id
     WHERE ph.facility_id = a.facility_id) AS total_prescriptions,
    
    (SELECT COUNT(*) FROM prescriptions pr
     JOIN profiles ph ON pr.approved_by = ph.id
     WHERE ph.facility_id = a.facility_id
     AND pr.created_at > NOW() - INTERVAL '24 hours') AS prescriptions_today,
    
    (SELECT COUNT(*) FROM prescriptions pr
     JOIN profiles ph ON pr.approved_by = ph.id
     WHERE ph.facility_id = a.facility_id
     AND pr.created_at > NOW() - INTERVAL '7 days') AS prescriptions_week,
    
    -- Inventory health
    (SELECT COUNT(*) FROM item_batches 
     WHERE facility_id = a.facility_id 
     AND current_quantity > 0) AS items_in_stock,
    
    (SELECT COUNT(*) FROM item_batches 
     WHERE facility_id = a.facility_id 
     AND current_quantity < 10 AND current_quantity > 0) AS low_stock_items,
    
    (SELECT COUNT(*) FROM item_batches 
     WHERE facility_id = a.facility_id 
     AND current_quantity = 0) AS out_of_stock_items,
    
    a.last_active_at,
    a.created_at AS joined_at
    
FROM profiles a
LEFT JOIN facilities f ON a.facility_id = f.id
WHERE a.role::text = 'admin';

COMMENT ON VIEW admin_metrics_summary IS 'Aggregated metrics for shop owners/admins';

-- 6. Platform-Wide Metrics Summary (For Super Admins)
CREATE OR REPLACE VIEW platform_metrics_summary AS
SELECT
    -- User counts by role
    (SELECT COUNT(*) FROM profiles WHERE role::text = 'customer') AS total_patients,
    (SELECT COUNT(*) FROM profiles WHERE role::text IN ('pharmacist', 'worker', 'cashier')) AS total_pharmacists,
    (SELECT COUNT(*) FROM profiles WHERE role::text = 'admin') AS total_admins,
    (SELECT COUNT(*) FROM profiles WHERE role::text IN ('super_admin_bms', 'super_admin_dev')) AS total_super_admins,
    (SELECT COUNT(*) FROM profiles) AS total_users,
    
    -- Active users
    (SELECT COUNT(*) FROM profiles WHERE last_active_at > NOW() - INTERVAL '24 hours') AS active_users_24h,
    (SELECT COUNT(*) FROM profiles WHERE last_active_at > NOW() - INTERVAL '7 days') AS active_users_7d,
    (SELECT COUNT(*) FROM profiles WHERE last_active_at > NOW() - INTERVAL '30 days') AS active_users_30d,
    
    -- New registrations
    (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '24 hours') AS new_users_24h,
    (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_7d,
    (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
    
    -- Blocked users
    (SELECT COUNT(*) FROM profiles WHERE is_blocked = true) AS blocked_users,
    
    -- Facility stats
    (SELECT COUNT(*) FROM facilities) AS total_facilities,
    (SELECT COUNT(*) FROM facilities WHERE is_active = true) AS active_facilities,
    
    -- Prescription stats (platform-wide)
    (SELECT COUNT(*) FROM prescriptions) AS total_prescriptions,
    (SELECT COUNT(*) FROM prescriptions WHERE created_at > NOW() - INTERVAL '24 hours') AS prescriptions_24h,
    (SELECT COUNT(*) FROM prescriptions WHERE created_at > NOW() - INTERVAL '7 days') AS prescriptions_7d,
    (SELECT COUNT(*) FROM prescriptions WHERE status = 'PENDING') AS pending_prescriptions,
    (SELECT COUNT(*) FROM prescriptions WHERE status = 'APPROVED') AS approved_prescriptions,
    
    -- Patient-Pharmacist assignments
    (SELECT COUNT(*) FROM patient_pharmacist_assignments WHERE status = 'active') AS active_assignments,
    
    -- Auth events
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '24 hours') AS logins_24h,
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
    
    -- Security
    (SELECT COUNT(*) FROM security_events WHERE resolved = false) AS unresolved_security_events,
    
    -- AI/System metrics
    (SELECT COUNT(*) FROM system_metrics WHERE metric_category = 'ai' AND recorded_at > NOW() - INTERVAL '24 hours') AS ai_calls_24h;

COMMENT ON VIEW platform_metrics_summary IS 'Platform-wide metrics for super admins';

-- 7. Helper function to assign patient to pharmacist
CREATE OR REPLACE FUNCTION assign_patient_to_pharmacist(
    p_patient_id UUID,
    p_pharmacist_id UUID,
    p_facility_id UUID DEFAULT NULL,
    p_is_primary BOOLEAN DEFAULT false,
    p_assigned_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_assignment_id UUID;
    v_facility UUID;
BEGIN
    -- Get pharmacist's facility if not provided
    IF p_facility_id IS NULL THEN
        SELECT facility_id INTO v_facility FROM profiles WHERE id = p_pharmacist_id;
    ELSE
        v_facility := p_facility_id;
    END IF;
    
    -- If marking as primary, unset other primary assignments for this patient
    IF p_is_primary THEN
        UPDATE patient_pharmacist_assignments 
        SET is_primary = false, updated_at = NOW()
        WHERE patient_id = p_patient_id AND is_primary = true;
    END IF;
    
    -- Insert or update assignment
    INSERT INTO patient_pharmacist_assignments (
        patient_id, pharmacist_id, facility_id, is_primary, assigned_by
    ) VALUES (
        p_patient_id, p_pharmacist_id, v_facility, p_is_primary, COALESCE(p_assigned_by, auth.uid())
    )
    ON CONFLICT (patient_id, pharmacist_id) 
    DO UPDATE SET 
        status = 'active',
        is_primary = EXCLUDED.is_primary,
        facility_id = EXCLUDED.facility_id,
        updated_at = NOW()
    RETURNING id INTO v_assignment_id;
    
    RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get pharmacist's patient list
CREATE OR REPLACE FUNCTION get_pharmacist_patients(p_pharmacist_id UUID)
RETURNS TABLE (
    patient_id UUID,
    patient_name TEXT,
    patient_email TEXT,
    is_primary BOOLEAN,
    assigned_at TIMESTAMPTZ,
    last_prescription TIMESTAMPTZ,
    total_prescriptions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS patient_id,
        p.full_name AS patient_name,
        p.email AS patient_email,
        ppa.is_primary,
        ppa.assigned_at,
        (SELECT MAX(created_at) FROM prescriptions WHERE patient_id = p.id) AS last_prescription,
        (SELECT COUNT(*) FROM prescriptions WHERE patient_id = p.id) AS total_prescriptions
    FROM patient_pharmacist_assignments ppa
    JOIN profiles p ON ppa.patient_id = p.id
    WHERE ppa.pharmacist_id = p_pharmacist_id
    AND ppa.status = 'active'
    ORDER BY ppa.is_primary DESC, ppa.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to get admin's staff with performance metrics
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

-- 10. Grant access to views
GRANT SELECT ON pharmacist_metrics_summary TO authenticated;
GRANT SELECT ON admin_metrics_summary TO authenticated;
GRANT SELECT ON platform_metrics_summary TO authenticated;

