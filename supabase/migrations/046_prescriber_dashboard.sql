-- 046_prescriber_dashboard.sql
-- Prescriber Dashboard Schema: Patient-centric prescribing with optional facility selection
-- Supports: 3-step workflow, EPCS compliance, drug safety checks, pharmacy transmission

-- =============================================
-- 1. PRESCRIBER PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS public.prescriber_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    prescriber_role TEXT CHECK (prescriber_role IN ('doctor', 'nurse', 'physician_assistant')) NOT NULL,
    dea_number TEXT, -- For controlled substances
    npi TEXT NOT NULL, -- National Provider Identifier
    license_number TEXT NOT NULL,
    license_state TEXT NOT NULL,
    facility_ids TEXT[], -- Optional facility associations (can be empty for facility-agnostic prescribers)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =============================================
-- 2. PATIENT MEDICATIONS (Active/Inactive tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS public.patient_medications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    drug_id UUID REFERENCES public.clinical_drugs(id), -- Links to clinical drug database
    drug_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    route TEXT, -- e.g., "oral", "IV", "topical"
    status TEXT CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED')) DEFAULT 'ACTIVE',
    start_date DATE NOT NULL,
    end_date DATE,
    prescribed_by UUID REFERENCES public.profiles(id), -- Prescriber who added this
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. PHARMACIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.pharmacies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    phone TEXT NOT NULL,
    fax TEXT,
    ncpdp_id TEXT, -- National Council for Prescription Drug Programs ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. PRESCRIPTION DRAFTS (Pending → Approval → Send)
-- =============================================
CREATE TABLE IF NOT EXISTS public.prescription_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    prescriber_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    drug_id UUID REFERENCES public.clinical_drugs(id),
    drug_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    dosage_form TEXT NOT NULL, -- e.g., "Tablet", "Capsule", "Syrup"
    directions TEXT NOT NULL CHECK (LENGTH(directions) <= 1000), -- Patient directions, max 1000 chars
    dispense_quantity NUMERIC NOT NULL,
    dispense_unit TEXT NOT NULL,
    refills INTEGER DEFAULT 0 CHECK (refills >= 0),
    days_supply INTEGER NOT NULL CHECK (days_supply > 0), -- Required for EPCS
    effective_date DATE NOT NULL, -- Required for EPCS
    no_substitution BOOLEAN DEFAULT FALSE,
    diagnosis_codes TEXT[], -- ICD or CDT codes (mandatory for controlled substances)
    pharmacy_id UUID REFERENCES public.pharmacies(id),
    facility_id UUID REFERENCES public.facilities(id), -- Optional: prescriber can select facility or leave null
    status TEXT CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT')) DEFAULT 'DRAFT',
    is_controlled BOOLEAN DEFAULT FALSE, -- Requires EPCS PIN
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. PATIENT PREFERRED PHARMACIES (Many-to-Many)
-- =============================================
CREATE TABLE IF NOT EXISTS public.patient_preferred_pharmacies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, pharmacy_id)
);

-- =============================================
-- 6. RXCHANGE REQUESTS (Pharmacy change after send)
-- =============================================
CREATE TABLE IF NOT EXISTS public.rxchange_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prescription_id UUID REFERENCES public.prescription_drafts(id) ON DELETE CASCADE NOT NULL,
    old_pharmacy_id UUID REFERENCES public.pharmacies(id),
    new_pharmacy_id UUID REFERENCES public.pharmacies(id) NOT NULL,
    requested_by UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. REFILL REQUESTS (Patient-initiated)
-- =============================================
CREATE TABLE IF NOT EXISTS public.refill_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    medication_id UUID REFERENCES public.patient_medications(id) ON DELETE CASCADE NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    notes TEXT
);

-- =============================================
-- 8. TRANSMISSION LOGS (eRx tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS public.transmission_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prescription_id UUID REFERENCES public.prescription_drafts(id) ON DELETE CASCADE NOT NULL,
    pharmacy_id UUID REFERENCES public.pharmacies(id) NOT NULL,
    status TEXT CHECK (status IN ('SENDING', 'SENT', 'VERIFIED', 'FAILED')) DEFAULT 'SENDING',
    error_message TEXT,
    transmitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. PRESCRIBER PINS (EPCS compliance)
-- =============================================
-- Requires pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.prescriber_pins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    pin_hash TEXT NOT NULL, -- Encrypted 4-digit PIN
    failed_attempts INTEGER DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON public.patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_status ON public.patient_medications(status);
CREATE INDEX IF NOT EXISTS idx_prescription_drafts_patient ON public.prescription_drafts(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_drafts_prescriber ON public.prescription_drafts(prescriber_id);
CREATE INDEX IF NOT EXISTS idx_prescription_drafts_status ON public.prescription_drafts(status);
CREATE INDEX IF NOT EXISTS idx_pharmacies_name ON public.pharmacies(name);
CREATE INDEX IF NOT EXISTS idx_transmission_logs_prescription ON public.transmission_logs(prescription_id);
CREATE INDEX IF NOT EXISTS idx_transmission_logs_status ON public.transmission_logs(status);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Prescriber Profiles
ALTER TABLE public.prescriber_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prescribers view own profile" ON public.prescriber_profiles;
CREATE POLICY "Prescribers view own profile"
ON public.prescriber_profiles FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all prescriber profiles" ON public.prescriber_profiles;
CREATE POLICY "Admins view all prescriber profiles"
ON public.prescriber_profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin_bms', 'super_admin_dev')
    )
);

DROP POLICY IF EXISTS "Prescribers manage own profile" ON public.prescriber_profiles;
CREATE POLICY "Prescribers manage own profile"
ON public.prescriber_profiles FOR ALL
USING (auth.uid() = user_id);

-- Patient Medications
ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients view own medications" ON public.patient_medications;
CREATE POLICY "Patients view own medications"
ON public.patient_medications FOR SELECT
USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Staff view all medications" ON public.patient_medications;
CREATE POLICY "Staff view all medications"
ON public.patient_medications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
    OR EXISTS (
        SELECT 1 FROM public.prescriber_profiles
        WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Prescribers manage medications" ON public.patient_medications;
CREATE POLICY "Prescribers manage medications"
ON public.patient_medications FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.prescriber_profiles
        WHERE user_id = auth.uid()
    )
);

-- Prescription Drafts
ALTER TABLE public.prescription_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients view own prescriptions" ON public.prescription_drafts;
CREATE POLICY "Patients view own prescriptions"
ON public.prescription_drafts FOR SELECT
USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Prescribers view own prescriptions" ON public.prescription_drafts;
CREATE POLICY "Prescribers view own prescriptions"
ON public.prescription_drafts FOR SELECT
USING (auth.uid() = prescriber_id);

DROP POLICY IF EXISTS "Prescribers manage own prescriptions" ON public.prescription_drafts;
CREATE POLICY "Prescribers manage own prescriptions"
ON public.prescription_drafts FOR ALL
USING (auth.uid() = prescriber_id);

DROP POLICY IF EXISTS "Pharmacists view prescriptions" ON public.prescription_drafts;
CREATE POLICY "Pharmacists view prescriptions"
ON public.prescription_drafts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
);

-- Pharmacies (Public read)
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read pharmacies" ON public.pharmacies;
CREATE POLICY "Public read pharmacies"
ON public.pharmacies FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins manage pharmacies" ON public.pharmacies;
CREATE POLICY "Admins manage pharmacies"
ON public.pharmacies FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin_bms', 'super_admin_dev')
    )
);

-- Patient Preferred Pharmacies
ALTER TABLE public.patient_preferred_pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients manage own preferred pharmacies" ON public.patient_preferred_pharmacies;
CREATE POLICY "Patients manage own preferred pharmacies"
ON public.patient_preferred_pharmacies FOR ALL
USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Staff view preferred pharmacies" ON public.patient_preferred_pharmacies;
CREATE POLICY "Staff view preferred pharmacies"
ON public.patient_preferred_pharmacies FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
    OR EXISTS (
        SELECT 1 FROM public.prescriber_profiles
        WHERE user_id = auth.uid()
    )
);

-- RxChange Requests
ALTER TABLE public.rxchange_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prescribers view own rxchange requests" ON public.rxchange_requests;
CREATE POLICY "Prescribers view own rxchange requests"
ON public.rxchange_requests FOR SELECT
USING (
    auth.uid() = requested_by
    OR EXISTS (
        SELECT 1 FROM public.prescription_drafts
        WHERE id = prescription_id AND prescriber_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Prescribers create rxchange requests" ON public.rxchange_requests;
CREATE POLICY "Prescribers create rxchange requests"
ON public.rxchange_requests FOR INSERT
WITH CHECK (auth.uid() = requested_by);

DROP POLICY IF EXISTS "Pharmacists manage rxchange requests" ON public.rxchange_requests;
CREATE POLICY "Pharmacists manage rxchange requests"
ON public.rxchange_requests FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
);

-- Refill Requests
ALTER TABLE public.refill_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients manage own refill requests" ON public.refill_requests;
CREATE POLICY "Patients manage own refill requests"
ON public.refill_requests FOR ALL
USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Prescribers view refill requests" ON public.refill_requests;
CREATE POLICY "Prescribers view refill requests"
ON public.refill_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.prescriber_profiles
        WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Prescribers update refill requests" ON public.refill_requests;
CREATE POLICY "Prescribers update refill requests"
ON public.refill_requests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.prescriber_profiles
        WHERE user_id = auth.uid()
    )
);

-- Transmission Logs
ALTER TABLE public.transmission_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prescribers view own transmission logs" ON public.transmission_logs;
CREATE POLICY "Prescribers view own transmission logs"
ON public.transmission_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.prescription_drafts
        WHERE id = prescription_id AND prescriber_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Pharmacists view transmission logs" ON public.transmission_logs;
CREATE POLICY "Pharmacists view transmission logs"
ON public.transmission_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('pharmacist', 'admin', 'super_admin_bms', 'super_admin_dev')
    )
);

DROP POLICY IF EXISTS "System create transmission logs" ON public.transmission_logs;
CREATE POLICY "System create transmission logs"
ON public.transmission_logs FOR INSERT
WITH CHECK (true); -- Edge functions will create these

-- Prescriber PINs (Highly restricted)
ALTER TABLE public.prescriber_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prescribers manage own PIN" ON public.prescriber_pins;
CREATE POLICY "Prescribers manage own PIN"
ON public.prescriber_pins FOR ALL
USING (auth.uid() = user_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to validate EPCS PIN
CREATE OR REPLACE FUNCTION public.validate_prescriber_pin(
    p_user_id UUID,
    p_pin TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_pin_record RECORD;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    -- Get PIN record
    SELECT * INTO v_pin_record
    FROM public.prescriber_pins
    WHERE user_id = p_user_id;

    -- Check if PIN exists
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if locked
    IF v_pin_record.is_locked THEN
        RETURN FALSE;
    END IF;

    -- Validate PIN (compare hashed values)
    IF v_pin_record.pin_hash = crypt(p_pin, v_pin_record.pin_hash) THEN
        v_is_valid := TRUE;
        
        -- Reset failed attempts and update last used
        UPDATE public.prescriber_pins
        SET failed_attempts = 0,
            last_used_at = NOW()
        WHERE user_id = p_user_id;
    ELSE
        -- Increment failed attempts
        UPDATE public.prescriber_pins
        SET failed_attempts = failed_attempts + 1,
            is_locked = CASE WHEN failed_attempts + 1 >= 3 THEN TRUE ELSE FALSE END
        WHERE user_id = p_user_id;
    END IF;

    RETURN v_is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create/update EPCS PIN
CREATE OR REPLACE FUNCTION public.set_prescriber_pin(
    p_user_id UUID,
    p_pin TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Validate PIN format (4 digits)
    IF p_pin !~ '^\d{4}$' THEN
        RAISE EXCEPTION 'PIN must be exactly 4 digits';
    END IF;

    -- Insert or update PIN
    INSERT INTO public.prescriber_pins (user_id, pin_hash)
    VALUES (p_user_id, crypt(p_pin, gen_salt('bf')))
    ON CONFLICT (user_id)
    DO UPDATE SET
        pin_hash = crypt(p_pin, gen_salt('bf')),
        failed_attempts = 0,
        is_locked = FALSE,
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- AUDIT TRIGGERS
-- =============================================

-- Trigger for prescription drafts
CREATE OR REPLACE FUNCTION public.log_prescription_draft_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by, details)
    VALUES (
        TG_OP,
        'prescription_draft',
        COALESCE(NEW.id, OLD.id),
        auth.uid(),
        jsonb_build_object(
            'patient_id', COALESCE(NEW.patient_id, OLD.patient_id),
            'drug_name', COALESCE(NEW.drug_name, OLD.drug_name),
            'status', COALESCE(NEW.status, OLD.status)
        )
    );
    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create audit log for prescription draft: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_prescription_draft_change ON public.prescription_drafts;
CREATE TRIGGER on_prescription_draft_change
AFTER INSERT OR UPDATE OR DELETE ON public.prescription_drafts
FOR EACH ROW EXECUTE FUNCTION public.log_prescription_draft_changes();

-- Trigger for PIN operations
CREATE OR REPLACE FUNCTION public.log_pin_operations()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by, details)
    VALUES (
        TG_OP,
        'prescriber_pin',
        COALESCE(NEW.id, OLD.id),
        auth.uid(),
        jsonb_build_object(
            'user_id', COALESCE(NEW.user_id, OLD.user_id),
            'is_locked', COALESCE(NEW.is_locked, OLD.is_locked),
            'failed_attempts', COALESCE(NEW.failed_attempts, OLD.failed_attempts)
        )
    );
    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create audit log for PIN operation: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pin_operation ON public.prescriber_pins;
CREATE TRIGGER on_pin_operation
AFTER INSERT OR UPDATE OR DELETE ON public.prescriber_pins
FOR EACH ROW EXECUTE FUNCTION public.log_pin_operations();
