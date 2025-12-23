-- 073_patient_ecosystem.sql
-- Implements Phase 5: Patient & Prescriber Ecosystem
-- Includes: Linked Profiles, Medication Adherence, Consultations, and Messaging Enhancements

-- 1. LINKED PROFILES (Family/Caregivers)
CREATE TABLE IF NOT EXISTS public.linked_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    primary_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    linked_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Can be null if inviting by email/phone initially
    relationship TEXT NOT NULL, -- 'child', 'parent', 'spouse', 'caregiver'
    permissions JSONB DEFAULT '{"view_records": true, "manage_meds": false}'::jsonb,
    status TEXT CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
    invite_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linked_profiles_primary ON public.linked_profiles(primary_user_id);
CREATE INDEX idx_linked_profiles_linked ON public.linked_profiles(linked_user_id);

ALTER TABLE public.linked_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users browse their links" ON public.linked_profiles
    FOR SELECT USING (auth.uid() = primary_user_id OR auth.uid() = linked_user_id);

CREATE POLICY "Users manage their invites" ON public.linked_profiles
    FOR ALL USING (auth.uid() = primary_user_id);

-- 2. MEDICATION ADHERENCE (Schedules & Logs)
CREATE TABLE IF NOT EXISTS public.medication_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT NOT NULL, -- e.g. "daily", "bid", "tid"
    times TIME[] NOT NULL, -- Array of times to take: ['08:00', '20:00']
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    reminder_methods TEXT[] DEFAULT '{"PUSH"}'::text[], -- 'PUSH', 'EMAIL', 'SMS'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.medication_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID REFERENCES public.medication_schedules(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    taken_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('TAKEN', 'SKIPPED', 'MISSED')) DEFAULT 'MISSED',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own schedules" ON public.medication_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own logs" ON public.medication_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own schedules" ON public.medication_schedules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own logs" ON public.medication_logs FOR ALL USING (auth.uid() = user_id);

-- 3. CONSULTATIONS (Telehealth)
CREATE TABLE IF NOT EXISTS public.consultations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Pharmacist or Prescriber
    facility_id UUID REFERENCES public.facilities(id), -- Optional linkage for audit
    type TEXT CHECK (type IN ('GENERAL', 'MENTAL_HEALTH', 'ADHERENCE', 'DOSAGE')) DEFAULT 'GENERAL',
    status TEXT CHECK (status IN ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED')) DEFAULT 'REQUESTED',
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 15,
    room_url TEXT, -- Link to Jitsi/Daily/WebRTC room
    fee NUMERIC(10, 2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their consultations" ON public.consultations 
    FOR SELECT USING (auth.uid() = patient_id OR auth.uid() = provider_id);

CREATE POLICY "Providers update consultations" ON public.consultations 
    FOR UPDATE USING (auth.uid() = provider_id);

-- 4. MESSAGING ENHANCEMENTS (Ensure facility auditing)
-- Check if table exists, if not create (fallback), if yes, add columns if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        CREATE TABLE public.messages (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            sender_id UUID REFERENCES public.profiles(id) NOT NULL,
            receiver_id UUID REFERENCES public.profiles(id) NOT NULL,
            content TEXT NOT NULL,
            read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Add audit columns to messages if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'facility_id') THEN
        ALTER TABLE public.messages ADD COLUMN facility_id UUID REFERENCES public.facilities(id);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'consultation_id') THEN
        ALTER TABLE public.messages ADD COLUMN consultation_id UUID REFERENCES public.consultations(id);
    END IF;
END $$;

-- RPC: Book Consultation
CREATE OR REPLACE FUNCTION public.book_consultation(
    p_provider_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_type TEXT DEFAULT 'GENERAL',
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_consultation_id UUID;
    v_fee NUMERIC;
BEGIN
    -- Basic fee logic (placeholder)
    v_fee := CASE WHEN p_type = 'MENTAL_HEALTH' THEN 50.00 ELSE 15.00 END;

    INSERT INTO public.consultations (patient_id, provider_id, scheduled_at, type, fee, notes)
    VALUES (auth.uid(), p_provider_id, p_scheduled_at, p_type, v_fee, p_notes)
    RETURNING id INTO v_consultation_id;

    RETURN v_consultation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
