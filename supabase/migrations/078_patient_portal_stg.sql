-- Migration: 078_patient_portal_stg.sql
-- Purpose: Enhance Patient Portal Schema for STG compliance (Antibiotic tracking, Symptom logs)

-- 1. Enhance Medication Schedules
ALTER TABLE public.medication_schedules
ADD COLUMN IF NOT EXISTS is_antibiotic BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('HIGH', 'MODERATE', 'LOW')) DEFAULT 'MODERATE';

-- 2. Symptom Logs (Structured Check-ins)
CREATE TABLE IF NOT EXISTS public.symptom_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    check_in_type TEXT NOT NULL, -- e.g. 'GENERAL_WELLNESS', 'TB_MONITORING', 'MALARIA_FOLLOWUP'
    responses JSONB NOT NULL, -- { "fever": "NO", "breathing": "BETTER" }
    red_flag_triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, date, check_in_type)
);

-- 3. RLS for Symptom Logs
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own symptom logs" ON public.symptom_logs;
CREATE POLICY "Users manage own symptom logs" ON public.symptom_logs
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians view linked patient symptoms" ON public.symptom_logs;
CREATE POLICY "Clinicians view linked patient symptoms" ON public.symptom_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.linked_profiles lp 
            WHERE lp.linked_user_id = public.symptom_logs.user_id 
            AND lp.primary_user_id = auth.uid() -- Caregiver Access
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND p.role::text IN ('pharmacist', 'prescriber', 'nurse')
            AND p.facility_id IN (
                SELECT facility_id FROM public.profiles WHERE id = public.symptom_logs.user_id
            )
        )
    );

-- 4. Audit Trigger for Symptom Logs
CREATE TRIGGER audit_symptom_logs AFTER INSERT OR UPDATE OR DELETE ON public.symptom_logs
  FOR EACH ROW EXECUTE FUNCTION log_store_audit();
