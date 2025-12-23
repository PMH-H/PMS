
-- audit_rls.sql
-- Purpose: Identify security gaps (RLS disabled, weak policies, missing search_path)

-- 1. Tables with RLS Disabled (excluding system tables)
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname IN ('public', 'inventory', 'commerce', 'clinical') 
  AND rowsecurity = FALSE;

-- 2. Functions with SECURITY DEFINER but missing search_path
-- (This is a heuristic/approximate check for config)
SELECT n.nspname AS schema, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = TRUE 
  AND (proconfig IS NULL OR NOT 'search_path' = ANY(proconfig))
  AND n.nspname IN ('public', 'inventory', 'commerce', 'clinical');

-- 3. Check for public-writable tables (Should not exist ideally)
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE roles @> '{public}'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
