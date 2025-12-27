-- Migration: 093_fix_metrics_and_notifications.sql
-- Description: Ensure all metric dependency tables exist and provide robust RPC for dashboard stats

-- 1. Ensure auth_events table exists
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- 'login_success', 'login_failed', 'logout', 'password_reset'
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at DESC);
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- 2. Ensure security_events table exists
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- 'suspicious_activity', 'access_denied', 'policy_violation'
    severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- 3. Create Robust Dashboard Stats RPC
-- This function bypasses RLS for aggregation purposes (SECURITY DEFINER)
-- and returns a JSON object matching the AdminMetricsSummary interface
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats(p_facility_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_patients INTEGER;
    v_total_pharmacists INTEGER;
    v_total_admins INTEGER;
    v_blocked_users INTEGER;
    v_active_24h INTEGER;
    v_active_7d INTEGER;
    
    v_total_prescriptions INTEGER;
    v_pending_prescriptions INTEGER;
    v_approved_prescriptions INTEGER;
    
    v_logins_24h INTEGER;
    v_failed_logins_24h INTEGER;
    v_unresolved_security_events INTEGER;
    v_critical_security_events INTEGER;
    
    v_total_facilities INTEGER;
BEGIN
    -- Scoping: If p_facility_id is provided, limit to that facility (for Facility Admins)
    -- If NULL, assumes Super Admin context (or logic to handle all)
    -- Assuming this RPC is primarily for Super Admins unless filtered
    
    -- User Counts
    SELECT COUNT(*) INTO v_total_patients FROM profiles WHERE role = 'customer' AND (p_facility_id IS NULL OR facility_id = p_facility_id);
    SELECT COUNT(*) INTO v_total_pharmacists FROM profiles WHERE role = 'pharmacist' AND (p_facility_id IS NULL OR facility_id = p_facility_id);
    SELECT COUNT(*) INTO v_total_admins FROM profiles WHERE role = 'admin'; -- Admins might manage the facility
    
    -- Active Users logic (using auth_events or last_sign_in_at if available, fallback to profiles.updated_at)
    -- We'll use profiles.last_active_at if it exists (from 054 migration view definition)
    -- OR auth_events if populated. Let's use auth_events for 24h as it's more accurate for "Logins"
    
    SELECT COUNT(DISTINCT user_id) INTO v_active_24h 
    FROM auth_events 
    WHERE created_at > now() - interval '24 hours';
    
    SELECT COUNT(DISTINCT user_id) INTO v_active_7d
    FROM auth_events 
    WHERE created_at > now() - interval '7 days';

    -- Prescription Counts
    SELECT COUNT(*) INTO v_total_prescriptions 
    FROM prescriptions 
    WHERE (p_facility_id IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = prescriptions.patient_id AND profiles.facility_id = p_facility_id));
    
    SELECT COUNT(*) INTO v_pending_prescriptions 
    FROM prescriptions 
    WHERE status = 'pending' 
    AND (p_facility_id IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = prescriptions.patient_id AND profiles.facility_id = p_facility_id));

    SELECT COUNT(*) INTO v_approved_prescriptions 
    FROM prescriptions 
    WHERE status = 'approved' 
    AND (p_facility_id IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = prescriptions.patient_id AND profiles.facility_id = p_facility_id));

    -- Auth Events
    SELECT COUNT(*) INTO v_logins_24h 
    FROM auth_events 
    WHERE event_type = 'login_success' AND created_at > now() - interval '24 hours';
    
    SELECT COUNT(*) INTO v_failed_logins_24h 
    FROM auth_events 
    WHERE event_type = 'login_failed' AND created_at > now() - interval '24 hours';
    
    -- Security Events
    SELECT COUNT(*) INTO v_unresolved_security_events 
    FROM security_events 
    WHERE resolved = false;
    
    SELECT COUNT(*) INTO v_critical_security_events 
    FROM security_events 
    WHERE severity = 'CRITICAL' AND resolved = false;
    
    -- Facility Count
    SELECT COUNT(*) INTO v_total_facilities FROM facilities;

    -- Construct JSON
    RETURN jsonb_build_object(
        'total_patients', COALESCE(v_total_patients, 0),
        'total_pharmacists', COALESCE(v_total_pharmacists, 0),
        'total_admins', COALESCE(v_total_admins, 0),
        'blocked_users', 0, -- Placeholder
        'active_24h', COALESCE(v_active_24h, 0),
        'active_7d', COALESCE(v_active_7d, 0),
        'total_prescriptions', COALESCE(v_total_prescriptions, 0),
        'pending_prescriptions', COALESCE(v_pending_prescriptions, 0),
        'approved_prescriptions', COALESCE(v_approved_prescriptions, 0),
        'logins_24h', COALESCE(v_logins_24h, 0),
        'failed_logins_24h', COALESCE(v_failed_logins_24h, 0),
        'unresolved_security_events', COALESCE(v_unresolved_security_events, 0),
        'critical_security_events', COALESCE(v_critical_security_events, 0),
        'total_facilities', COALESCE(v_total_facilities, 0)
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats(UUID) TO authenticated;
GRANT SELECT, INSERT ON auth_events TO authenticated;
GRANT SELECT, INSERT ON security_events TO authenticated;
GRANT ALL ON auth_events TO service_role;
GRANT ALL ON security_events TO service_role;
