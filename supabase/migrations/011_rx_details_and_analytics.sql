-- =====================================================
-- PRESCRIPTION DETAILS, HISTORY & AI ANALYTICS
-- Migration: 011_rx_details_and_analytics.sql (FIXED)
-- Purpose: Enable detailed prescription tracking, history, and AI learning
-- Retention: Default 1 month (configurable by admins)
-- =====================================================

-- =====================================================
-- 1. PRESCRIPTION ENHANCEMENTS
-- =====================================================

-- Add new columns to prescriptions table
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS ai_analysis_notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacist_verification_notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_request_notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

-- Add index for verification queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_verified ON prescriptions(verified_at, verified_by);

-- =====================================================
-- 2. PRESCRIPTION HISTORY TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS prescription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES profiles(id),
    change_type TEXT NOT NULL CHECK (change_type IN (
        'CREATED', 
        'STATUS_UPDATED', 
        'MEDICATIONS_UPDATED', 
        'AI_ANALYZED', 
        'PHARMACIST_VERIFIED',
        'PATIENT_CLARIFICATION',
        'SYSTEM_UPDATE'
    )),
    previous_data JSONB,
    new_data JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_prescription_history_prescription ON prescription_history(prescription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_history_type ON prescription_history(change_type, created_at DESC);

-- =====================================================
-- 3. PRESCRIPTION NOTES (Multi-source)
-- =====================================================

CREATE TABLE IF NOT EXISTS prescription_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    note_type TEXT NOT NULL CHECK (note_type IN (
        'SYSTEM',
        'AI_ANALYSIS',
        'PHARMACIST',
        'PATIENT',
        'ADMIN'
    )),
    author_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notes
CREATE INDEX IF NOT EXISTS idx_prescription_notes_prescription ON prescription_notes(prescription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_notes_type ON prescription_notes(note_type);

-- =====================================================
-- 4. AI PREDICTION FEEDBACK (Reinforced Learning)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_prediction_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN (
        'MEDICATION_EXTRACTION',
        'INTERACTION_CHECK',
        'DOSAGE_VALIDATION',
        'IMAGE_QUALITY',
        'HANDWRITING_RECOGNITION'
    )),
    ai_prediction JSONB NOT NULL,
    actual_result JSONB NOT NULL,
    accuracy_score DECIMAL(3,2) CHECK (accuracy_score BETWEEN 0 AND 1),
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    feedback_provided_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_ai_feedback_prescription ON ai_prediction_feedback(prescription_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_prediction_feedback(prediction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_accuracy ON ai_prediction_feedback(accuracy_score);

-- =====================================================
-- 5. DATA RETENTION SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS data_retention_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default retention period (1 month)
INSERT INTO data_retention_settings (setting_key, setting_value, description)
VALUES 
    ('prescription_history_retention_days', '30', 'Number of days to retain prescription history records'),
    ('ai_feedback_retention_days', '90', 'Number of days to retain AI feedback data for learning'),
    ('prescription_notes_retention_days', '365', 'Number of days to retain prescription notes')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- 6. AUTOMATED CLEANUP FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_prescription_data()
RETURNS void AS $$
DECLARE
    history_retention_days INTEGER;
    feedback_retention_days INTEGER;
    notes_retention_days INTEGER;
    deleted_count INTEGER;
BEGIN
    -- Get retention settings
    SELECT setting_value::INTEGER INTO history_retention_days
    FROM data_retention_settings WHERE setting_key = 'prescription_history_retention_days';
    
    SELECT setting_value::INTEGER INTO feedback_retention_days
    FROM data_retention_settings WHERE setting_key = 'ai_feedback_retention_days';
    
    SELECT setting_value::INTEGER INTO notes_retention_days
    FROM data_retention_settings WHERE setting_key = 'prescription_notes_retention_days';

    -- Clean up old history records
    DELETE FROM prescription_history
    WHERE created_at < NOW() - (history_retention_days || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % old prescription history records', deleted_count;

    -- Clean up old AI feedback
    DELETE FROM ai_prediction_feedback
    WHERE created_at < NOW() - (feedback_retention_days || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % old AI feedback records', deleted_count;

    -- Clean up old notes (except PHARMACIST and PATIENT notes - keep for legal reasons)
    DELETE FROM prescription_notes
    WHERE created_at < NOW() - (notes_retention_days || ' days')::INTERVAL
    AND note_type IN ('SYSTEM', 'AI_ANALYSIS');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % old system/AI notes', deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE prescription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prediction_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_settings ENABLE ROW LEVEL SECURITY;

-- prescription_history policies (FIXED - removed facility_id references)
DROP POLICY IF EXISTS "Users view own prescription history" ON prescription_history;
CREATE POLICY "Users view own prescription history"
ON prescription_history FOR SELECT
USING (
    prescription_id IN (
        SELECT id FROM prescriptions 
        WHERE patient_id = auth.uid()
    )
    OR
    -- Staff can view all prescriptions at their facility
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() 
        AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
    )
);

DROP POLICY IF EXISTS "Staff create prescription history" ON prescription_history;
CREATE POLICY "Staff create prescription history"
ON prescription_history FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() 
        AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
    )
);

-- prescription_notes policies (FIXED - removed facility_id references)
DROP POLICY IF EXISTS "Users view prescription notes" ON prescription_notes;
CREATE POLICY "Users view prescription notes"
ON prescription_notes FOR SELECT
USING (
    prescription_id IN (
        SELECT id FROM prescriptions 
        WHERE patient_id = auth.uid()
    )
    OR
    -- Staff can view all notes
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() 
        AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
    )
);

DROP POLICY IF EXISTS "Staff add prescription notes" ON prescription_notes;
CREATE POLICY "Staff add prescription notes"
ON prescription_notes FOR INSERT
WITH CHECK (
    -- Staff can add notes
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() 
        AND role IN ('PHARMACIST', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
    )
    OR
    -- Patients can add clarification notes to their own prescriptions
    (note_type = 'PATIENT' AND EXISTS (
        SELECT 1 FROM prescriptions WHERE id = prescription_id AND patient_id = auth.uid()
    ))
);

-- ai_prediction_feedback policies
DROP POLICY IF EXISTS "Pharmacists provide AI feedback" ON ai_prediction_feedback;
CREATE POLICY "Pharmacists provide AI feedback"
ON ai_prediction_feedback FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('PHARMACIST', 'ADMIN')
    )
);

DROP POLICY IF EXISTS "Admins view AI feedback" ON ai_prediction_feedback;
CREATE POLICY "Admins view AI feedback"
ON ai_prediction_feedback FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV')
    )
);

-- data_retention_settings policies
DROP POLICY IF EXISTS "Admins manage retention settings" ON data_retention_settings;
CREATE POLICY "Admins manage retention settings"
ON data_retention_settings FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN_BMS')
    )
);

-- =====================================================
-- 8. NOTIFICATION TRIGGER FOR RETENTION CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION notify_admins_retention_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert alert for all facilities (since prescriptions don't have facility_id)
    INSERT INTO alerts (facility_id, type, message, metadata)
    SELECT 
        id as facility_id,
        'SYSTEM_CONFIG',
        'Data retention settings updated: ' || NEW.setting_key || ' = ' || NEW.setting_value || ' days',
        jsonb_build_object(
            'setting_key', NEW.setting_key,
            'old_value', OLD.setting_value,
            'new_value', NEW.setting_value,
            'updated_by', NEW.updated_by
        )
    FROM facilities
    WHERE type IN ('DISTRICT', 'REGION');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS retention_settings_changed ON data_retention_settings;
CREATE TRIGGER retention_settings_changed
AFTER UPDATE ON data_retention_settings
FOR EACH ROW
WHEN (OLD.setting_value IS DISTINCT FROM NEW.setting_value)
EXECUTE FUNCTION notify_admins_retention_change();

-- =====================================================
-- 9. HELPER VIEWS FOR ANALYTICS
-- =====================================================

-- AI Accuracy Summary View
CREATE OR REPLACE VIEW ai_accuracy_summary AS
SELECT 
    prediction_type,
    COUNT(*) as total_predictions,
    AVG(accuracy_score) as avg_accuracy,
    AVG(confidence_score) as avg_confidence,
    COUNT(*) FILTER (WHERE accuracy_score >= 0.9) as high_accuracy_count,
    COUNT(*) FILTER (WHERE accuracy_score < 0.5) as low_accuracy_count,
    DATE_TRUNC('day', created_at) as prediction_date
FROM ai_prediction_feedback
GROUP BY prediction_type, DATE_TRUNC('day', created_at)
ORDER BY prediction_date DESC;

-- Prescription Processing Timeline View
CREATE OR REPLACE VIEW prescription_processing_timeline AS
SELECT 
    p.id as prescription_id,
    p.patient_id,
    p.created_at as submitted_at,
    p.verified_at,
    p.status,
    EXTRACT(EPOCH FROM (p.verified_at - p.created_at))/60 as processing_time_minutes,
    COUNT(ph.id) as total_changes,
    COUNT(pn.id) as total_notes
FROM prescriptions p
LEFT JOIN prescription_history ph ON ph.prescription_id = p.id
LEFT JOIN prescription_notes pn ON pn.prescription_id = p.id
GROUP BY p.id, p.patient_id, p.created_at, p.verified_at, p.status;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE prescription_history IS 'Tracks all changes to prescriptions for audit and compliance';
COMMENT ON TABLE prescription_notes IS 'Multi-source notes (System, AI, Pharmacist, Patient)';
COMMENT ON TABLE ai_prediction_feedback IS 'AI prediction accuracy tracking for reinforced learning';
COMMENT ON TABLE data_retention_settings IS 'Configurable data retention periods (default: 1 month)';
