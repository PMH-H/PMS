-- 082_schema_zoning_clinical.sql
-- Move Core Clinical Tables to "clinical" schema
-- Maintain Public Interface via Views + Triggers

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS clinical;
GRANT USAGE ON SCHEMA clinical TO postgres, authenticated, service_role;

-- 2. Move Tables (FKs move with them)
-- We need to move dependent tables first or all at once.
-- Tables: prescriptions, medication_schedules, medication_logs, symptom_logs, consultations, linked_profiles (optional, staying in public for now as it's social)

ALTER TABLE public.prescriptions SET SCHEMA clinical;
ALTER TABLE public.medication_schedules SET SCHEMA clinical;
ALTER TABLE public.medication_logs SET SCHEMA clinical;
ALTER TABLE public.symptom_logs SET SCHEMA clinical;
ALTER TABLE public.consultations SET SCHEMA clinical;

-- 3. Create Interface Views in Public
-- Prescriptions
CREATE OR REPLACE VIEW public.prescriptions AS SELECT * FROM clinical.prescriptions;

-- Medication Schedules
CREATE OR REPLACE VIEW public.medication_schedules AS SELECT * FROM clinical.medication_schedules;

-- Medication Logs
CREATE OR REPLACE VIEW public.medication_logs AS SELECT * FROM clinical.medication_logs;

-- Symptom Logs
CREATE OR REPLACE VIEW public.symptom_logs AS SELECT * FROM clinical.symptom_logs;

-- Consultations
CREATE OR REPLACE VIEW public.consultations AS SELECT * FROM clinical.consultations;

-- 4. Create INSTEAD OF Triggers for INSERT/UPDATE/DELETE
-- This allows the frontend to write to the views as if they were tables.

-- A. Prescriptions Triggers
CREATE OR REPLACE FUNCTION public.io_prescriptions() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO clinical.prescriptions (id, patient_id, status, image_url, medications, interactions, created_at, updated_at)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.patient_id, NEW.status, NEW.image_url, NEW.medications, NEW.interactions, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE clinical.prescriptions SET
            status = NEW.status,
            image_url = NEW.image_url,
            medications = NEW.medications,
            interactions = NEW.interactions,
            updated_at = now()
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM clinical.prescriptions WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_prescriptions_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.io_prescriptions();

-- B. Medication Schedules Triggers
CREATE OR REPLACE FUNCTION public.io_med_schedules() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO clinical.medication_schedules (id, user_id, medication_name, dosage, frequency, times, start_date, end_date, reminder_methods, is_active, created_at, is_antibiotic, priority)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.user_id, NEW.medication_name, NEW.dosage, NEW.frequency, NEW.times, NEW.start_date, NEW.end_date, NEW.reminder_methods, NEW.is_active, COALESCE(NEW.created_at, now()), NEW.is_antibiotic, NEW.priority)
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE clinical.medication_schedules SET
            medication_name = NEW.medication_name,
            dosage = NEW.dosage,
            frequency = NEW.frequency,
            times = NEW.times,
            end_date = NEW.end_date,
            reminder_methods = NEW.reminder_methods,
            is_active = NEW.is_active,
            is_antibiotic = NEW.is_antibiotic,
            priority = NEW.priority
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM clinical.medication_schedules WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_med_schedules_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.medication_schedules
    FOR EACH ROW EXECUTE FUNCTION public.io_med_schedules();

-- C. Medication Logs Triggers
CREATE OR REPLACE FUNCTION public.io_med_logs() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO clinical.medication_logs (id, schedule_id, user_id, scheduled_time, taken_at, status, notes, created_at)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.schedule_id, NEW.user_id, NEW.scheduled_time, NEW.taken_at, NEW.status, NEW.notes, COALESCE(NEW.created_at, now()))
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE clinical.medication_logs SET
            taken_at = NEW.taken_at,
            status = NEW.status,
            notes = NEW.notes
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM clinical.medication_logs WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_med_logs_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.medication_logs
    FOR EACH ROW EXECUTE FUNCTION public.io_med_logs();

-- D. Symptom Logs Triggers
CREATE OR REPLACE FUNCTION public.io_symptom_logs() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO clinical.symptom_logs (id, user_id, date, check_in_type, responses, red_flag_triggered, created_at)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.user_id, NEW.date, NEW.check_in_type, NEW.responses, NEW.red_flag_triggered, COALESCE(NEW.created_at, now()))
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE clinical.symptom_logs SET
            responses = NEW.responses,
            red_flag_triggered = NEW.red_flag_triggered
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM clinical.symptom_logs WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_symptom_logs_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.symptom_logs
    FOR EACH ROW EXECUTE FUNCTION public.io_symptom_logs();

-- E. Consultations Triggers
CREATE OR REPLACE FUNCTION public.io_consultations() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO clinical.consultations (id, patient_id, provider_id, facility_id, type, status, scheduled_at, duration_minutes, room_url, fee, payment_status, notes, created_at)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.patient_id, NEW.provider_id, NEW.facility_id, NEW.type, NEW.status, NEW.scheduled_at, NEW.duration_minutes, NEW.room_url, NEW.fee, NEW.payment_status, NEW.notes, COALESCE(NEW.created_at, now()))
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE clinical.consultations SET
            status = NEW.status,
            scheduled_at = NEW.scheduled_at,
            room_url = NEW.room_url,
            payment_status = NEW.payment_status,
            notes = NEW.notes
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM clinical.consultations WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_consultations_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.consultations
    FOR EACH ROW EXECUTE FUNCTION public.io_consultations();

-- 5. Fix RLS & Permissions
-- The Tables moved, so we need to enable RLS on the NEW schema tables.
ALTER TABLE clinical.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.symptom_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.consultations ENABLE ROW LEVEL SECURITY;

-- Grant permissions on Views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.symptom_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultations TO authenticated;

-- 6. Apply Policies to New Schema Tables
-- (Policies moved with table, but might need tweaking if they referenced 'public.prescriptions')
-- Postgres usually auto-updates schema references in policies if attached to the table.
-- However, we must ensure users have access.

-- Basic Policy check (idempotent, just in case)
DO $$
BEGIN
    -- Only create if missing (example for prescriptions)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'clinical' AND tablename = 'prescriptions' AND policyname = 'Patients view own prescriptions') THEN
        CREATE POLICY "Patients view own prescriptions" ON clinical.prescriptions
            FOR SELECT USING (auth.uid() = patient_id);
    END IF;
END $$;
