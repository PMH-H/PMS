
-- 092_security_hardening.sql
-- Phase 10: Security Hardening & Super Admin Access

-- 1. Enable RLS on ALL tables in app schemas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname IN ('public', 'inventory', 'commerce', 'clinical')
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. Define Super Admin Policy Helpers
-- (We use separate policies to keep things clean, rather than huge OR blocks)

-- A. Profiles (Super Admin can view/edit all)
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super Admins can manage all profiles" ON public.profiles
    USING (
        (auth.jwt() ->> 'role' = 'super_admin_dev') OR 
        (auth.jwt() ->> 'role' = 'super_admin_bms')
    )
    WITH CHECK (
        (auth.jwt() ->> 'role' = 'super_admin_dev') OR 
        (auth.jwt() ->> 'role' = 'super_admin_bms')
    );

-- B. Facilities (Super Admin can manage all)
DROP POLICY IF EXISTS "Super Admins can manage all facilities" ON public.facilities;
CREATE POLICY "Super Admins can manage all facilities" ON public.facilities
    USING (
        (auth.jwt() ->> 'role' = 'super_admin_dev') OR 
        (auth.jwt() ->> 'role' = 'super_admin_bms')
    )
    WITH CHECK (
        (auth.jwt() ->> 'role' = 'super_admin_dev') OR 
        (auth.jwt() ->> 'role' = 'super_admin_bms')
    );

-- C. Inventory (View All for Super Admin)
-- Apply to key inventory tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'inventory' LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Super Admin Access" ON inventory.%I', t);
            EXECUTE format('CREATE POLICY "Super Admin Access" ON inventory.%I USING ((auth.jwt() ->> ''role'' = ''super_admin_dev'') OR (auth.jwt() ->> ''role'' = ''super_admin_bms''))', t);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignore if policy not applicable or other error
        END;
    END LOOP;
END $$;

-- D. Commerce (View All for Super Admin)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'commerce' LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Super Admin Access" ON commerce.%I', t);
            EXECUTE format('CREATE POLICY "Super Admin Access" ON commerce.%I USING ((auth.jwt() ->> ''role'' = ''super_admin_dev'') OR (auth.jwt() ->> ''role'' = ''super_admin_bms''))', t);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;

-- 3. Secure Critical Functions (Search Path)
-- Fix potentially vulnerable Security Definer functions
ALTER FUNCTION public.get_admin_staff OWNER TO postgres;
ALTER FUNCTION public.get_admin_staff SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.create_new_user OWNER TO postgres;
ALTER FUNCTION public.create_new_user SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.log_message_audit OWNER TO postgres;
ALTER FUNCTION public.log_message_audit SET search_path = audit, public, pg_temp;

-- 4. Audit Log Immutability for Audit Schema
-- Revoke Update/Delete from everyone except maybe postgres superuser (which isn't actionable via these commands usually for owner)
-- But we can revoke from roles.
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit FROM authenticated;
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit FROM service_role;
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit FROM public;

-- End of Hardening
