-- =====================================================================
-- Migration 035: Super Admin Metrics & User Management
-- Adds tables for auth events, system metrics, feature flags,
-- and user blocking functionality
-- =====================================================================

-- 1. Auth Events Table - Track all authentication activity
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login_success', 
        'login_failed', 
        'logout', 
        'password_reset_request', 
        'password_reset_complete',
        'session_expired',
        'token_refresh',
        'mfa_enabled',
        'mfa_disabled'
    )),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying recent auth events
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON auth_events(event_type);

-- 2. System Metrics Table - Store metric snapshots
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_category TEXT NOT NULL CHECK (metric_category IN (
        'auth', 'business', 'performance', 'security', 
        'compliance', 'system', 'user', 'ai'
    )),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit TEXT,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for metric queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_category ON system_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC);

-- 3. Feature Flags Table - Control feature rollouts
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    flag_description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    applies_to_roles TEXT[] DEFAULT '{}',
    applies_to_facilities UUID[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Security Events Table - Track security-related activity
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'suspicious_activity',
        'blocked_ip',
        'permission_violation',
        'rate_limit_exceeded',
        'invalid_token',
        'brute_force_attempt',
        'unusual_location'
    )),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ip_address INET,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    description TEXT,
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

-- 5. Add blocking columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- 6. Create RLS Policies

-- Auth Events: Only super admins can view
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view all auth events" ON auth_events;
CREATE POLICY "Super admins can view all auth events" ON auth_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin_dev'::user_role, 'super_admin_bms'::user_role)
        )
    );

DROP POLICY IF EXISTS "System can insert auth events" ON auth_events;
CREATE POLICY "System can insert auth events" ON auth_events
    FOR INSERT WITH CHECK (true);

-- System Metrics: Only super admins can view/manage
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage system metrics" ON system_metrics;
CREATE POLICY "Super admins can manage system metrics" ON system_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin_dev'::user_role, 'super_admin_bms'::user_role)
        )
    );

-- Feature Flags: Super admins can manage, all can read enabled flags for their role
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage feature flags" ON feature_flags;
CREATE POLICY "Super admins can manage feature flags" ON feature_flags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin_dev'::user_role
        )
    );

DROP POLICY IF EXISTS "Users can view applicable feature flags" ON feature_flags;
CREATE POLICY "Users can view applicable feature flags" ON feature_flags
    FOR SELECT USING (
        is_enabled = true AND (
            applies_to_roles = '{}' OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() 
                AND role::text = ANY(applies_to_roles)
            )
        )
    );

-- Security Events: Only super admins can view
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view security events" ON security_events;
CREATE POLICY "Super admins can view security events" ON security_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin_dev'::user_role, 'super_admin_bms'::user_role)
        )
    );

-- 7. Insert default feature flags
INSERT INTO feature_flags (flag_name, flag_description, is_enabled, applies_to_roles) VALUES
    ('ai_prescription_parsing', 'Enable AI-powered prescription image parsing', true, '{}'),
    ('maintenance_mode', 'Put the application in maintenance mode', false, '{}'),
    ('new_user_registration', 'Allow new user registrations', true, '{}'),
    ('realtime_notifications', 'Enable real-time push notifications', true, '{}'),
    ('dark_mode', 'Enable dark mode UI option', false, '{}'),
    ('advanced_analytics', 'Show advanced analytics dashboards', true, ARRAY['super_admin_dev', 'super_admin_bms', 'admin']),
    ('dev_tools', 'Enable developer tools access', true, ARRAY['super_admin_dev'])
ON CONFLICT (flag_name) DO NOTHING;

-- 8. Create helper function to log auth events
CREATE OR REPLACE FUNCTION log_auth_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_failure_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO auth_events (user_id, event_type, ip_address, user_agent, success, failure_reason, metadata)
    VALUES (p_user_id, p_event_type, p_ip_address, p_user_agent, p_success, p_failure_reason, p_metadata)
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to update last_active_at on login
CREATE OR REPLACE FUNCTION update_last_active() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'login_success' AND NEW.user_id IS NOT NULL THEN
        UPDATE profiles SET last_active_at = NOW() WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_last_active_trigger ON auth_events;
CREATE TRIGGER update_last_active_trigger
    AFTER INSERT ON auth_events
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();

-- 10. Create view for dashboard metrics summary
-- Cast role to text for comparison since role is user_role enum
CREATE OR REPLACE VIEW admin_metrics_summary AS
SELECT
    -- User counts (cast role enum to text for comparison)
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
    
    -- Auth events
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '24 hours') AS logins_24h,
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
    
    -- Security
    (SELECT COUNT(*) FROM security_events WHERE resolved = false) AS unresolved_security_events,
    (SELECT COUNT(*) FROM security_events WHERE severity = 'critical' AND resolved = false) AS critical_security_events,
    
    -- Facilities
    (SELECT COUNT(*) FROM facilities) AS total_facilities;

COMMENT ON VIEW admin_metrics_summary IS 'Aggregated metrics for super admin dashboards';
