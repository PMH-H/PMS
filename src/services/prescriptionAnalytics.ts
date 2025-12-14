// =====================================================
// PRESCRIPTION ANALYTICS SERVICE
// =====================================================
// Handles AI prediction tracking, feedback, and learning metrics
// =====================================================

import { supabase } from './supabase';

// =====================================================
// AI PREDICTION FEEDBACK
// =====================================================

export interface AIPredictionFeedback {
    prescription_id: string;
    prediction_type: 'MEDICATION_EXTRACTION' | 'INTERACTION_CHECK' | 'DOSAGE_VALIDATION' | 'IMAGE_QUALITY' | 'HANDWRITING_RECOGNITION';
    ai_prediction: any;
    actual_result: any;
    accuracy_score: number; // 0.0 to 1.0
    confidence_score: number; // 0.0 to 1.0
    feedback_provided_by: string;
}

export const recordAIPredictionFeedback = async (feedback: AIPredictionFeedback) => {
    const { data, error } = await supabase
        .from('ai_prediction_feedback')
        .insert([feedback])
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Calculate accuracy score automatically
export const calculateAccuracyScore = (aiPrediction: any, actualResult: any): number => {
    // Simple comparison for medications array
    if (Array.isArray(aiPrediction) && Array.isArray(actualResult)) {
        const aiMeds = aiPrediction.map(m => m.name?.toLowerCase());
        const actualMeds = actualResult.map(m => m.name?.toLowerCase());

        const matches = aiMeds.filter(med => actualMeds.includes(med)).length;
        const total = Math.max(aiMeds.length, actualMeds.length);

        return total > 0 ? matches / total : 0;
    }

    // For other types, do simple equality check
    return JSON.stringify(aiPrediction) === JSON.stringify(actualResult) ? 1.0 : 0.0;
};

// =====================================================
// PRESCRIPTION HISTORY
// =====================================================

export interface PrescriptionHistoryEntry {
    prescription_id: string;
    changed_by?: string;
    change_type: 'CREATED' | 'STATUS_UPDATED' | 'MEDICATIONS_UPDATED' | 'AI_ANALYZED' | 'PHARMACIST_VERIFIED' | 'PATIENT_CLARIFICATION' | 'SYSTEM_UPDATE';
    previous_data?: any;
    new_data?: any;
    notes?: string;
}

export const addPrescriptionHistory = async (entry: PrescriptionHistoryEntry) => {
    const { data, error } = await supabase
        .from('prescription_history')
        .insert([entry])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getPrescriptionHistory = async (prescriptionId: string) => {
    const { data, error } = await supabase
        .from('prescription_history')
        .select('*, profiles:changed_by(full_name)')
        .eq('prescription_id', prescriptionId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

// =====================================================
// PRESCRIPTION NOTES
// =====================================================

export interface PrescriptionNote {
    prescription_id: string;
    note_type: 'SYSTEM' | 'AI_ANALYSIS' | 'PHARMACIST' | 'PATIENT' | 'ADMIN';
    author_id?: string;
    content: string;
    metadata?: any;
}

export const addPrescriptionNote = async (note: PrescriptionNote) => {
    const { data, error } = await supabase
        .from('prescription_notes')
        .insert([note])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getPrescriptionNotes = async (prescriptionId: string) => {
    const { data, error } = await supabase
        .from('prescription_notes')
        .select('*, profiles:author_id(full_name)')
        .eq('prescription_id', prescriptionId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

// =====================================================
// AI ANALYTICS & METRICS
// =====================================================

export const getAIAccuracyMetrics = async (dateRange?: { start: string; end: string }) => {
    let query = supabase
        .from('ai_prediction_feedback')
        .select('*');

    if (dateRange) {
        query = query
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate aggregated metrics
    const metrics = {
        total_predictions: data.length,
        avg_accuracy: data.reduce((sum, f) => sum + f.accuracy_score, 0) / data.length || 0,
        avg_confidence: data.reduce((sum, f) => sum + f.confidence_score, 0) / data.length || 0,
        by_type: {} as Record<string, { count: number; avg_accuracy: number; avg_confidence: number }>
    };

    // Group by prediction type
    data.forEach(feedback => {
        if (!metrics.by_type[feedback.prediction_type]) {
            metrics.by_type[feedback.prediction_type] = {
                count: 0,
                avg_accuracy: 0,
                avg_confidence: 0
            };
        }
        const typeMetrics = metrics.by_type[feedback.prediction_type];
        typeMetrics.count++;
        typeMetrics.avg_accuracy += feedback.accuracy_score;
        typeMetrics.avg_confidence += feedback.confidence_score;
    });

    // Calculate averages
    Object.keys(metrics.by_type).forEach(type => {
        const typeMetrics = metrics.by_type[type];
        typeMetrics.avg_accuracy /= typeMetrics.count;
        typeMetrics.avg_confidence /= typeMetrics.count;
    });

    return metrics;
};

// Get AI accuracy summary view
export const getAIAccuracySummary = async (days: number = 30) => {
    const { data, error } = await supabase
        .from('ai_accuracy_summary')
        .select('*')
        .gte('prediction_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('prediction_date', { ascending: false });

    if (error) throw error;
    return data;
};

// Get prescription processing timeline
export const getPrescriptionProcessingMetrics = async (facilityId?: string) => {
    let query = supabase
        .from('prescription_processing_timeline')
        .select('*');

    if (facilityId) {
        // Would need to join with prescriptions table
        // For now, return all
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;
    return data;
};

// =====================================================
// DATA RETENTION MANAGEMENT
// =====================================================

export const getRetentionSettings = async () => {
    const { data, error } = await supabase
        .from('data_retention_settings')
        .select('*');

    if (error) throw error;
    return data;
};

export const updateRetentionSetting = async (
    settingKey: string,
    newValue: string,
    updatedBy: string
) => {
    const { data, error } = await supabase
        .from('data_retention_settings')
        .update({
            setting_value: newValue,
            updated_by: updatedBy,
            updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Manually trigger cleanup (admin only)
export const triggerDataCleanup = async () => {
    const { data, error } = await supabase.rpc('cleanup_old_prescription_data');

    if (error) throw error;
    return data;
};

// =====================================================
// PRESCRIPTION VERIFICATION
// =====================================================

export const verifyPrescription = async (
    prescriptionId: string,
    verifiedBy: string,
    notes?: string
) => {
    // Update prescription
    const { data: prescription, error: updateError } = await supabase
        .from('prescriptions')
        .update({
            status: 'READY',
            verified_at: new Date().toISOString(),
            verified_by: verifiedBy,
            pharmacist_verification_notes: notes
        })
        .eq('id', prescriptionId)
        .select()
        .single();

    if (updateError) throw updateError;

    // Add history entry
    await addPrescriptionHistory({
        prescription_id: prescriptionId,
        changed_by: verifiedBy,
        change_type: 'PHARMACIST_VERIFIED',
        notes: notes || 'Prescription verified and approved'
    });

    // Add note if provided
    if (notes) {
        await addPrescriptionNote({
            prescription_id: prescriptionId,
            note_type: 'PHARMACIST',
            author_id: verifiedBy,
            content: notes
        });
    }

    return prescription;
};

export const rejectPrescription = async (
    prescriptionId: string,
    rejectedBy: string,
    reason: string
) => {
    // Update prescription
    const { data: prescription, error: updateError } = await supabase
        .from('prescriptions')
        .update({
            status: 'CANCELLED'
        })
        .eq('id', prescriptionId)
        .select()
        .single();

    if (updateError) throw updateError;

    // Add history entry
    await addPrescriptionHistory({
        prescription_id: prescriptionId,
        changed_by: rejectedBy,
        change_type: 'STATUS_UPDATED',
        notes: `Prescription rejected: ${reason}`
    });

    // Add note
    await addPrescriptionNote({
        prescription_id: prescriptionId,
        note_type: 'PHARMACIST',
        author_id: rejectedBy,
        content: `Rejected: ${reason}`
    });

    return prescription;
};
