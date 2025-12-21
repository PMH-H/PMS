-- Fix admin_metrics_summary view which was incorrectly overwritten in 050
DROP VIEW IF EXISTS public.admin_metrics_summary;

CREATE OR REPLACE VIEW public.admin_metrics_summary AS
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
    
    -- Prescription metrics
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

    -- Store/Ecommerce metrics (Restored from 050 logic but scoped to facility)
    (SELECT COUNT(*) FROM store_orders so
     WHERE so.facility_id = a.facility_id 
     AND so.created_at > NOW() - INTERVAL '24 hours') AS orders_24h,
     
    (SELECT COALESCE(SUM(total_price_cents), 0) FROM store_orders so
     WHERE so.facility_id = a.facility_id 
     AND so.status = 'COMPLETED') AS total_store_revenue,

    -- Auth & Security Metrics
    (SELECT COUNT(*) FROM auth_events ae
     JOIN profiles p ON ae.user_id = p.id
     WHERE p.facility_id = a.facility_id
     AND ae.event_type = 'login_success'
     AND ae.created_at > NOW() - INTERVAL '24 hours') AS logins_24h,

    (SELECT COUNT(*) FROM auth_events ae
     JOIN profiles p ON ae.user_id = p.id
     WHERE p.facility_id = a.facility_id
     AND ae.event_type = 'login_failed'
     AND ae.created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,

    (SELECT COUNT(*) FROM security_events se
     JOIN profiles p ON se.user_id = p.id
     WHERE p.facility_id = a.facility_id
     AND se.resolved = false) AS unresolved_security_events,
    
    a.last_active_at,
    a.created_at AS joined_at
    
FROM profiles a
LEFT JOIN facilities f ON a.facility_id = f.id
WHERE a.role::text = 'admin';

-- Enable RLS permissions (View inherits from underlying tables but good to be explicit for API access)
GRANT SELECT ON public.admin_metrics_summary TO authenticated;
GRANT SELECT ON public.admin_metrics_summary TO service_role;

-- Re-apply get_admin_staff to ensure it exists
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

GRANT EXECUTE ON FUNCTION get_admin_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_staff(UUID) TO service_role;
