-- 074_provider_access_logs.sql
-- Allow Prescribers and Pharmacists to view patient adherence data

DROP POLICY IF EXISTS "Providers view all schedules" ON public.medication_schedules;
CREATE POLICY "Providers view all schedules" ON public.medication_schedules
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role::text IN ('pharmacist', 'prescriber', 'admin', 'super_admin_bms', 'super_admin_dev')
  )
);

DROP POLICY IF EXISTS "Providers view all logs" ON public.medication_logs;
CREATE POLICY "Providers view all logs" ON public.medication_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role::text IN ('pharmacist', 'prescriber', 'admin', 'super_admin_bms', 'super_admin_dev')
  )
);
