-- 1. Enable RLS on vulnerable tables
ALTER TABLE public.patient_pharmacist_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Basic Policies for Assignments (if none exist)
-- Allow pharmacists to view their assignments
CREATE POLICY "Pharmacists view own assignments" ON public.patient_pharmacist_assignments
    FOR SELECT USING (auth.uid() = pharmacist_id);

-- Allow patients to view their assignments
CREATE POLICY "Patients view own assignments" ON public.patient_pharmacist_assignments
    FOR SELECT USING (auth.uid() = patient_id);

-- Allow facility admins to manage assignments
CREATE POLICY "Admins manage assignments" ON public.patient_pharmacist_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role::text IN ('pharmacist_admin', 'super_admin', 'super_admin_bms', 'super_admin_dev', 'admin')
            AND facility_id = public.patient_pharmacist_assignments.facility_id
        )
    );

-- 3. Fix Mutable Search Paths for Functions (Security hardening)
-- This prevents search_path hijacking attacks
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
-- ALTER FUNCTION public.log_audit_event(text, uuid, text, jsonb, jsonb, text, uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.notify_admins_retention_change() SET search_path = public;
-- ALTER FUNCTION public.log_metric_event(text, jsonb, uuid) SET search_path = public;
-- ALTER FUNCTION public.create_sale_atomic(uuid, jsonb, numeric, text, uuid, text) SET search_path = public;
-- ALTER FUNCTION public.select_fefo_batch(uuid, uuid, integer) SET search_path = public;
-- ALTER FUNCTION public.process_sale_stock_update() SET search_path = public;
-- ALTER FUNCTION public.check_and_create_stock_alert(uuid, uuid, uuid) SET search_path = public;
-- ALTER FUNCTION public.log_table_changes() SET search_path = public;
-- ALTER FUNCTION public.refresh_sales_aggregates() SET search_path = public;
-- ALTER FUNCTION public.cleanup_old_prescription_data() SET search_path = public;
-- ALTER FUNCTION public.update_last_active() SET search_path = public;
-- ALTER FUNCTION public.handle_new_user() SET search_path = public;
-- ALTER FUNCTION public.upsert_push_subscription(jsonb, text) SET search_path = public;
-- ALTER FUNCTION public.staff_leave_current_facility(text) SET search_path = public;
-- ALTER FUNCTION public.handle_staff_leave_facility() SET search_path = public;
-- ALTER FUNCTION public.get_admin_staff(uuid) SET search_path = public;
-- ALTER FUNCTION public.is_staff(uuid) SET search_path = public;
-- ALTER FUNCTION public.recalculate_abc_classes(uuid) SET search_path = public;
-- ALTER FUNCTION public.recalculate_abc_item_level(uuid, uuid) SET search_path = public;
-- ALTER FUNCTION public.auto_approve_patient_signup() SET search_path = public;
-- ALTER FUNCTION public.get_user_role() SET search_path = public;
-- ALTER FUNCTION public.get_user_facility() SET search_path = public;
-- ALTER FUNCTION public.is_admin_or_above() SET search_path = public;
-- ALTER FUNCTION public.is_shop_member() SET search_path = public;
-- ALTER FUNCTION public.update_signup_timestamp() SET search_path = public;
-- ALTER FUNCTION public.approve_join_request(uuid, uuid) SET search_path = public;
-- ALTER FUNCTION public.has_facility_access(uuid) SET search_path = public;
-- ALTER FUNCTION public.validate_prescriber_pin(text) SET search_path = public;
-- ALTER FUNCTION public.log_auth_event(uuid, text, boolean, text, jsonb) SET search_path = public;
-- ALTER FUNCTION public.set_prescriber_pin(text) SET search_path = public;
-- ALTER FUNCTION public.log_prescription_draft_changes() SET search_path = public;
-- ALTER FUNCTION public.log_pin_operations() SET search_path = public;
-- ALTER FUNCTION public.sync_profile_email() SET search_path = public;
-- ALTER FUNCTION public.get_pharmacist_patients(uuid) SET search_path = public;
-- ALTER FUNCTION public.get_prescriptions_with_profiles(uuid, text) SET search_path = public;
-- ALTER FUNCTION public.book_consultation(uuid, uuid, text, timestamp with time zone) SET search_path = public;
-- ALTER FUNCTION public.admin_link_staff_member(text, uuid) SET search_path = public;
-- ALTER FUNCTION public.log_store_audit() SET search_path = public;
-- ALTER FUNCTION public.mark_notifications_read() SET search_path = public;
-- ALTER FUNCTION public.get_unread_notification_count() SET search_path = public;
-- ALTER FUNCTION public.increment_article_views(uuid) SET search_path = public;

-- 4. Secure Views (Remove SECURITY DEFINER from public views if not absolutely needed)
-- Instead of blindly removing, we drop and recreate without SECURITY DEFINER 
-- OR strictly control access. For now, we will REVOKE public access to sensitive views.

REVOKE SELECT ON public.prescriptions_with_profile FROM public;
GRANT SELECT ON public.prescriptions_with_profile TO authenticated;

REVOKE SELECT ON public.admin_metrics_summary FROM public;
GRANT SELECT ON public.admin_metrics_summary TO authenticated;

-- 5. Cost Control: Disable Realtime on High-Traffic Tables
-- Only keep Chat-related tables or specific status update tables
DO $$
BEGIN
    -- Prescriptions
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'prescriptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.prescriptions;
    END IF;

    -- Medication Logs
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'medication_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.medication_logs;
    END IF;

    -- Stock Movements
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stock_movements'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.stock_movements;
    END IF;

    -- Audit Logs
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs;
    END IF;

    -- Audit Log (Singular)
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_log'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_log;
    END IF;

    -- System Metrics
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_metrics'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.system_metrics;
    END IF;

    -- Platform Metrics
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'platform_metrics'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.platform_metrics;
    END IF;
END $$;
