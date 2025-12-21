-- =====================================================
-- 050: Role Expansion & Metrics Sync
-- =====================================================

-- 1. Expand User Roles Enum (Note: Handled manually due to transaction constraints)
-- Role expansion logic moved to manual execution or separate non-transactional script.

-- 2. Update Admin Metrics Summary View to include store metrics
-- This ensures the dashboard sees eCommerce activity
DROP VIEW IF EXISTS admin_metrics_summary;

CREATE VIEW admin_metrics_summary AS
SELECT
    -- User counts
    (SELECT COUNT(*) FROM profiles WHERE role::text = 'customer') AS total_patients,
    (SELECT COUNT(*) FROM profiles WHERE role::text = 'pharmacist') AS total_pharmacists,
    (SELECT COUNT(*) FROM profiles WHERE role::text = 'admin') AS total_admins,
    (SELECT COUNT(*) FROM profiles WHERE is_blocked = true) AS blocked_users,
    (SELECT COUNT(*) FROM profiles WHERE last_active_at > NOW() - INTERVAL '24 hours') AS active_24h,
    (SELECT COUNT(*) FROM profiles WHERE last_active_at > NOW() - INTERVAL '7 days') AS active_7d,
    
    -- Prescription counts
    (SELECT COUNT(*) FROM prescriptions WHERE created_at > NOW() - INTERVAL '24 hours') AS prescriptions_24h,
    (SELECT COUNT(*) FROM prescriptions WHERE status ILIKE 'PENDING') AS pending_prescriptions,
    (SELECT COUNT(*) FROM prescriptions WHERE status ILIKE 'APPROVED') AS approved_prescriptions,
    
    -- Store/Ecommerce metrics (from 047/049)
    (SELECT COUNT(*) FROM store_orders WHERE created_at > NOW() - INTERVAL '24 hours') AS orders_24h,
    (SELECT COALESCE(SUM(total_price_cents), 0) FROM store_orders WHERE status = 'COMPLETED') AS total_store_revenue,
    
    -- Auth events (from 035)
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '24 hours') AS logins_24h,
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
    
    -- Security (from 035)
    (SELECT COUNT(*) FROM security_events WHERE resolved = false) AS unresolved_security_events,
    (SELECT COUNT(*) FROM security_events WHERE severity = 'critical' AND resolved = false) AS critical_security_events,
    
    -- Facilities
    (SELECT COUNT(*) FROM facilities) AS total_facilities;

COMMENT ON VIEW admin_metrics_summary IS 'Aggregated metrics for super admin dashboards including store activity';
