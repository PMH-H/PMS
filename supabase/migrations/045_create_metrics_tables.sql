-- Ensure dependencies exist
CREATE TABLE IF NOT EXISTS public.patient_pharmacist_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pharmacist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES public.profiles(id),
    is_primary BOOLEAN DEFAULT false,
    status TEXT CHECK (status IN ('active', 'inactive', 'transferred')) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(patient_id, pharmacist_id)
);

-- Create auth_events table
CREATE TABLE IF NOT EXISTS public.auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- login_success, login_failed, logout, etc.
    success BOOLEAN DEFAULT true,
    ip_address TEXT,
    user_agent TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create security_events table
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- suspicious_activity, blocked_ip, etc.
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins view all auth events" ON public.auth_events;
CREATE POLICY "Admins view all auth events" ON public.auth_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin_bms', 'super_admin_dev'))
    );

DROP POLICY IF EXISTS "Users view own auth events" ON public.auth_events;
CREATE POLICY "Users view own auth events" ON public.auth_events
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all security events" ON public.security_events;
CREATE POLICY "Admins view all security events" ON public.security_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin_bms', 'super_admin_dev'))
    );

-- Update admin_metrics_summary view
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

    -- Auth & Security Metrics (NEW)
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

    (SELECT COUNT(*) FROM security_events se
     JOIN profiles p ON se.user_id = p.id
     WHERE p.facility_id = a.facility_id
     AND se.severity = 'critical'
     AND se.resolved = false) AS critical_security_events,
    
    a.last_active_at,
    a.created_at AS joined_at
    
FROM profiles a
LEFT JOIN facilities f ON a.facility_id = f.id
WHERE a.role::text = 'admin';

-- Update Platform Metrics Summary (For Super Admin) to include new event tables
DROP VIEW IF EXISTS public.platform_metrics_summary;

CREATE OR REPLACE VIEW public.platform_metrics_summary AS
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
    
    -- Auth events (REAL DATA NOW)
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '24 hours') AS logins_24h,
    (SELECT COUNT(*) FROM auth_events WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
    
    -- Security (REAL DATA NOW)
    (SELECT COUNT(*) FROM security_events WHERE resolved = false) AS unresolved_security_events,
    
    -- AI/System metrics
    COALESCE((SELECT COUNT(*) FROM system_metrics WHERE metric_category = 'ai' AND recorded_at > NOW() - INTERVAL '24 hours'), 0) AS ai_calls_24h;

GRANT SELECT ON public.admin_metrics_summary TO authenticated;
GRANT SELECT ON public.platform_metrics_summary TO authenticated;
