-- Migration 070: Include Admins in Pharmacist Metrics View
-- Admins perform pharmacist duties (approving scripts) and need to see their performance metrics.

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
WHERE p.role::text IN ('pharmacist', 'worker', 'cashier', 'admin');

-- Force schema reload
NOTIFY pgrst, 'reload schema';
