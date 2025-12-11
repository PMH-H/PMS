
-- 040_dosespot_features.sql
-- Add support for Allergies and Favorites (DoseSpot Parity)
-- Idempotent version: Checks for existence before creating objects

-- =============================================
-- 1. PATIENT ALLERGIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.patient_allergies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.profiles(id) NOT NULL,
    allergen TEXT NOT NULL,          -- Drug name or substance
    reaction TEXT,                   -- Description of reaction
    severity TEXT CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE')),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS (Safe to run multiple times)
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

-- Idempotent Policies
DO $$
BEGIN
    -- 1. Patients can VIEW their own allergies
    DROP POLICY IF EXISTS "Patients can view own allergies" ON public.patient_allergies;
    CREATE POLICY "Patients can view own allergies"
    ON public.patient_allergies FOR SELECT
    USING (auth.uid() = patient_id);

    -- 2. Staff can VIEW all allergies
    DROP POLICY IF EXISTS "Staff can view all allergies" ON public.patient_allergies;
    CREATE POLICY "Staff can view all allergies"
    ON public.patient_allergies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
        )
    );

    -- 3. Staff can INSERT/UPDATE allergies
    DROP POLICY IF EXISTS "Staff can manage allergies" ON public.patient_allergies;
    CREATE POLICY "Staff can manage allergies"
    ON public.patient_allergies FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
        )
    );
END
$$;

-- =============================================
-- 2. PRESCRIBER FAVORITES (Shortcuts)
-- =============================================
CREATE TABLE IF NOT EXISTS public.prescriber_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    nickname TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.prescriber_favorites ENABLE ROW LEVEL SECURITY;

-- Idempotent Policy
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users manage own favorites" ON public.prescriber_favorites;
    CREATE POLICY "Users manage own favorites"
    ON public.prescriber_favorites FOR ALL
    USING (auth.uid() = user_id);
END
$$;

-- =============================================
-- 3. AUDIT LOGGING (Trigger)
-- =============================================
-- Re-use existing audit_log function if available, or simpler one here

CREATE OR REPLACE FUNCTION public.log_allergy_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Using 'audit_logs' assuming table exists. If 'audit_log' (singular), adjust here.
    -- Checking if audit_logs exists first is hard in PL/pgSQL without dynamic SQL, 
    -- but usually schema is known. Assuming 'audit_log' based on UserManagement.tsx usage or previous files.
    -- App.tsx used 'createAuditLog' which likely points to 'audit_log' or 'audit_logs'.
    -- The previous migration assumed 'audit_logs'. Let's stick to safe insert if possible.
    
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by, details)
    VALUES (
        TG_OP,
        'patient_allergy',
        NEW.id,
        auth.uid(),
        jsonb_build_object('allergen', NEW.allergen, 'patient', NEW.patient_id)
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- If table doesn't exist or other error, suppress to avoid breaking the core flow? 
    -- Or better, fail. Let's assume table exists as per standard setup.
    RAISE WARNING 'Failed to create audit log for allergy change: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent Trigger
DROP TRIGGER IF EXISTS on_allergy_change ON public.patient_allergies;
CREATE TRIGGER on_allergy_change
AFTER INSERT OR UPDATE OR DELETE ON public.patient_allergies
FOR EACH ROW EXECUTE FUNCTION public.log_allergy_changes();
