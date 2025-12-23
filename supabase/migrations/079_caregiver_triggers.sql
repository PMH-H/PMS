-- 1. Function to notify caregivers when a RED FLAG symptom is logged
CREATE OR REPLACE FUNCTION public.notify_caregiver_on_red_flag()
RETURNS TRIGGER AS $$
DECLARE
    caregiver_record RECORD;
BEGIN
    -- Only proceed if red flag is triggered
    IF NEW.red_flag_triggered = TRUE THEN
        -- Find all caregivers (primary_user_id) linked to this patient (linked_user_id)
        FOR caregiver_record IN 
            SELECT primary_user_id 
            FROM public.linked_profiles 
            WHERE linked_user_id = NEW.user_id 
            AND status = 'ACCEPTED' -- Only active links
        LOOP
            -- Insert notification for the caregiver
            INSERT INTO public.notifications (user_id, title, message, type, is_read, metadata)
            VALUES (
                caregiver_record.primary_user_id,
                'Family Alert: Red Flag Symptom',
                'A family member reported severe symptoms. Please check the dashboard.',
                'HEALTH_ALERT',
                FALSE,
                jsonb_build_object('log_id', NEW.id, 'patient_id', NEW.user_id)
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on symptom_logs
DROP TRIGGER IF EXISTS on_symptom_red_flag_insert ON public.symptom_logs;
CREATE TRIGGER on_symptom_red_flag_insert
    AFTER INSERT ON public.symptom_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_caregiver_on_red_flag();


-- 3. Function to notify on Missed Critical Dose (Antibiotics)
CREATE OR REPLACE FUNCTION public.notify_caregiver_on_missed_critical()
RETURNS TRIGGER AS $$
DECLARE
    is_critical BOOLEAN;
    med_name TEXT;
    caregiver_record RECORD;
BEGIN
    -- Only check if status is MISSED or SKIPPED
    IF NEW.status IN ('MISSED', 'SKIPPED') THEN
        -- Check if schedule is antibiotic/critical
        SELECT is_antibiotic, medication_name INTO is_critical, med_name
        FROM public.medication_schedules
        WHERE id = NEW.schedule_id;

        IF is_critical THEN
            -- Find caregivers
            FOR caregiver_record IN 
                SELECT primary_user_id 
                FROM public.linked_profiles 
                WHERE linked_user_id = NEW.user_id 
                AND status = 'ACCEPTED'
            LOOP
                INSERT INTO public.notifications (user_id, title, message, type, is_read, metadata)
                VALUES (
                    caregiver_record.primary_user_id,
                    'Family Alert: Missed Antibiotic',
                    'A family member missed a critical dose of ' || med_name || '.',
                    'HEALTH_ALERT',
                    FALSE,
                    jsonb_build_object('log_id', NEW.id, 'patient_id', NEW.user_id, 'medication', med_name)
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger on medication_logs
DROP TRIGGER IF EXISTS on_medication_missed_critical ON public.medication_logs;
CREATE TRIGGER on_medication_missed_critical
    AFTER INSERT ON public.medication_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_caregiver_on_missed_critical();
