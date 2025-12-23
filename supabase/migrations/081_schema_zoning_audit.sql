-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS audit;
GRANT USAGE ON SCHEMA audit TO postgres, authenticated, service_role;

-- 2. Move Validation Function first (if it uses public tables)
-- In this case, log tables are usually standalone, but let's check dependencies.
-- audit_logs depends on profiles/users, which are in public/auth. Cross-schema FKs are fine.

-- 3. Move Tables
ALTER TABLE public.audit_logs SET SCHEMA audit;
ALTER TABLE public.audit_log SET SCHEMA audit; -- Legacy table

-- 4. Create Interface Views in Public
-- This ensures existing code (supabase.from('audit_logs')) keeps working.

-- 4a. View for audit_logs
CREATE OR REPLACE VIEW public.audit_logs AS
SELECT * FROM audit.audit_logs;

-- 4b. View for audit_log
CREATE OR REPLACE VIEW public.audit_log AS
SELECT * FROM audit.audit_log;

-- 5. Enable Insertions via Triggers (Private Table, Public View Pattern)

-- 5a. Function for inserting into audit.audit_logs
CREATE OR REPLACE FUNCTION public.insert_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.audit_logs (
        id, table_name, record_id, action, old_data, new_data, performed_by, created_at, actor_id
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), -- Handle ID generation if missing
        NEW.table_name,
        NEW.record_id,
        NEW.action,
        NEW.old_data,
        NEW.new_data,
        NEW.performed_by,
        COALESCE(NEW.created_at, now()),
        NEW.actor_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5b. Trigger for audit_logs view
CREATE TRIGGER insert_audit_logs_trigger
    INSTEAD OF INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.insert_audit_logs();

-- 5c. Function for inserting into audit.audit_log (Legacy)
CREATE OR REPLACE FUNCTION public.insert_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.audit_log (
        id, table_name, record_id, action, previous_data, new_data, performed_by, ip_address, user_agent, created_at, resource_type, resource_id, payload
    ) VALUES (
        COALESCE(NEW.id, uuid_generate_v4()),
        NEW.table_name,
        NEW.record_id,
        NEW.action,
        NEW.previous_data,
        NEW.new_data,
        NEW.performed_by,
        NEW.ip_address,
        NEW.user_agent,
        COALESCE(NEW.created_at, now()),
        NEW.resource_type,
        NEW.resource_id,
        NEW.payload
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5d. Trigger for audit_log view
CREATE TRIGGER insert_audit_log_trigger
    INSTEAD OF INSERT ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.insert_audit_log();

-- 6. Permissions & RLS
-- Views inherit permissions of the caller if not SECURITY DEFINER.
-- But since we use INSTEAD OF triggers for INSERT, we need to grant insert on the VIEW.
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;

-- Ensure RLS is enabled on the underlying tables
ALTER TABLE audit.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_log ENABLE ROW LEVEL SECURITY;

-- Re-apply Policies (Must reference the new schema table)
-- We need to drop old policies from public if they stuck (unlikely after move), and create new ones on audit.*

-- Policy: Users can see their own logs (or Admins see all)
DROP POLICY IF EXISTS "Admins view all audit logs" ON audit.audit_logs;
CREATE POLICY "Admins view all audit logs" ON audit.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role::text IN ('admin', 'super_admin_bms', 'super_admin_dev')
        )
    );

DROP POLICY IF EXISTS "Users view own audit logs" ON audit.audit_logs;
CREATE POLICY "Users view own audit logs" ON audit.audit_logs
    FOR SELECT USING (performed_by = auth.uid());
