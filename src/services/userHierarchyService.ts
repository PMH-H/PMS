// services/userHierarchyService.ts
// Handles user relationships and hierarchy queries

import { supabase } from './supabase';
import { User, UserRole } from '../types';

// ========================================
// Types
// ========================================

export interface PatientAssignment {
    id: string;
    patient_id: string;
    pharmacist_id: string;
    facility_id?: string;
    is_primary: boolean;
    status: 'active' | 'inactive' | 'transferred';
    assigned_at: string;
    assigned_by?: string;
}

export interface PharmacistPatient {
    patient_id: string;
    patient_name: string;
    patient_email?: string;
    is_primary: boolean;
    assigned_at: string;
    last_prescription?: string;
    total_prescriptions: number;
}

export interface AdminStaffMember {
    pharmacist_id: string;
    pharmacist_name: string;
    pharmacist_email?: string;
    role: string;
    patient_count: number;
    prescriptions_today: number;
    prescriptions_week: number;
    last_active?: string;
}

export interface PharmacistMetrics {
    pharmacist_id: string;
    pharmacist_name: string;
    facility_id?: string;
    facility_name?: string;
    active_patients: number;
    total_prescriptions_processed: number;
    prescriptions_today: number;
    prescriptions_week: number;
    approved_count: number;
    rejected_count: number;
    last_active_at?: string;
    joined_at: string;
}

export interface AdminMetrics {
    admin_id: string;
    admin_name: string;
    facility_id: string;
    facility_name: string;
    total_pharmacists: number;
    active_pharmacists_today: number;
    total_patients: number;
    total_prescriptions: number;
    prescriptions_today: number;
    prescriptions_week: number;
    items_in_stock: number;
    low_stock_items: number;
    out_of_stock_items: number;
    last_active_at: string;
    joined_at: string;
}

export interface PlatformMetrics {
    total_patients: number;
    total_pharmacists: number;
    total_admins: number;
    total_super_admins: number;
    total_users: number;
    active_users_24h: number;
    active_users_7d: number;
    active_users_30d: number;
    new_users_24h: number;
    new_users_7d: number;
    new_users_30d: number;
    blocked_users: number;
    total_facilities: number;
    active_facilities: number;
    total_prescriptions: number;
    prescriptions_24h: number;
    prescriptions_7d: number;
    pending_prescriptions: number;
    approved_prescriptions: number;
    active_assignments: number;
    logins_24h: number;
    failed_logins_24h: number;
    unresolved_security_events: number;
    ai_calls_24h: number;
}

// ========================================
// Patient-Pharmacist Assignments
// ========================================

/**
 * Assign a patient to a pharmacist
 */
export const assignPatientToPharmacist = async (
    patientId: string,
    pharmacistId: string,
    isPrimary: boolean = false,
    facilityId?: string
): Promise<{ data: PatientAssignment | null; error: Error | null }> => {
    try {
        const { data, error } = await supabase.rpc('assign_patient_to_pharmacist', {
            p_patient_id: patientId,
            p_pharmacist_id: pharmacistId,
            p_facility_id: facilityId,
            p_is_primary: isPrimary,
        });

        if (error) throw error;

        // Fetch the full assignment record
        const { data: assignment } = await supabase
            .from('patient_pharmacist_assignments')
            .select('*')
            .eq('id', data)
            .single();

        return { data: assignment, error: null };
    } catch (err) {
        console.error('Error assigning patient to pharmacist:', err);
        return { data: null, error: err as Error };
    }
};

/**
 * Remove patient-pharmacist assignment
 */
export const unassignPatient = async (
    patientId: string,
    pharmacistId: string
): Promise<{ success: boolean; error: Error | null }> => {
    try {
        const { error } = await supabase
            .from('patient_pharmacist_assignments')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .match({ patient_id: patientId, pharmacist_id: pharmacistId });

        if (error) throw error;
        return { success: true, error: null };
    } catch (err) {
        console.error('Error unassigning patient:', err);
        return { success: false, error: err as Error };
    }
};

/**
 * Get patients assigned to a pharmacist
 */
export const getPatientsByPharmacist = async (
    pharmacistId: string
): Promise<{ data: PharmacistPatient[]; error: Error | null }> => {
    try {
        const { data, error } = await supabase.rpc('get_pharmacist_patients', {
            p_pharmacist_id: pharmacistId,
        });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (err) {
        console.error('Error fetching pharmacist patients:', err);
        return { data: [], error: err as Error };
    }
};

/**
 * Get pharmacists assigned to a patient
 */
export const getPharmacistsByPatient = async (
    patientId: string
): Promise<{ data: any[]; error: Error | null }> => {
    try {
        const { data, error } = await supabase
            .from('patient_pharmacist_assignments')
            .select(`
                pharmacist_id,
                is_primary,
                pharmacist:profiles!patient_pharmacist_assignments_pharmacist_id_fkey(
                    id, full_name, email, phone, role, facility_id
                )
            `)
            .eq('patient_id', patientId)
            .eq('status', 'active');

        if (error) throw error;

        const pharmacists = data?.map(d => ({
            ...(d.pharmacist as any),
            is_primary: d.is_primary,
        })) || [];

        return { data: pharmacists, error: null };
    } catch (err) {
        console.error('Error fetching patient pharmacists:', err);
        return { data: [], error: err as Error };
    }
};

// ========================================
// Admin-Pharmacist Relationships
// ========================================

/**
 * Get staff members managed by an admin (same facility)
 */
export const getStaffByAdmin = async (
    adminId: string
): Promise<{ data: AdminStaffMember[]; error: Error | null }> => {
    try {
        const { data, error } = await supabase.rpc('get_admin_staff', {
            p_admin_id: adminId,
        });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (err) {
        console.error('Error fetching admin staff:', err);
        return { data: [], error: err as Error };
    }
};

/**
 * Set manager for a pharmacist
 */
export const setPharmacistManager = async (
    pharmacistId: string,
    managerId: string
): Promise<{ success: boolean; error: Error | null }> => {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ manager_id: managerId })
            .eq('id', pharmacistId);

        if (error) throw error;
        return { success: true, error: null };
    } catch (err) {
        console.error('Error setting pharmacist manager:', err);
        return { success: false, error: err as Error };
    }
};

/**
 * Get pharmacists by manager
 */
export const getPharmacistsByManager = async (
    managerId: string
): Promise<{ data: User[]; error: Error | null }> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('manager_id', managerId);

        if (error) throw error;
        return { data: data as User[] || [], error: null };
    } catch (err) {
        console.error('Error fetching managed pharmacists:', err);
        return { data: [], error: err as Error };
    }
};

// ========================================
// Metrics Functions
// ========================================

/**
 * Get pharmacist metrics
 */
export const getPharmacistMetrics = async (
    pharmacistId?: string
): Promise<{ data: PharmacistMetrics[]; error: Error | null }> => {
    try {
        let query = supabase.from('pharmacist_metrics_summary').select('*');

        if (pharmacistId) {
            query = query.eq('pharmacist_id', pharmacistId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { data: data || [], error: null };
    } catch (err) {
        console.error('Error fetching pharmacist metrics:', err);
        return { data: [], error: err as Error };
    }
};

/**
 * Get admin metrics
 */
export const getAdminMetrics = async (
    adminId?: string
): Promise<{ data: AdminMetrics[]; error: Error | null }> => {
    try {
        let query = supabase.from('admin_metrics_summary').select('*');

        if (adminId) {
            query = query.eq('admin_id', adminId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { data: data || [], error: null };
    } catch (err) {
        console.error('Error fetching admin metrics:', err);
        return { data: [], error: err as Error };
    }
};

/**
 * Get platform-wide metrics (for Super Admins)
 */
export const getPlatformMetrics = async (): Promise<{
    data: PlatformMetrics | null;
    error: Error | null
}> => {
    try {
        const { data, error } = await supabase
            .from('platform_metrics_summary')
            .select('*')
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        console.error('Error fetching platform metrics:', err);
        return { data: null, error: err as Error };
    }
};

/**
 * Get all users grouped by role
 */
export const getUsersByRole = async (): Promise<{
    data: Record<string, User[]>;
    error: Error | null;
}> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('role');

        if (error) throw error;

        // Group by role
        const grouped: Record<string, User[]> = {};
        for (const user of data || []) {
            const role = user.role as string;
            if (!grouped[role]) grouped[role] = [];
            grouped[role].push(user as User);
        }

        return { data: grouped, error: null };
    } catch (err) {
        console.error('Error fetching users by role:', err);
        return { data: {}, error: err as Error };
    }
};

/**
 * Get user hierarchy (for visualization)
 */
export const getUserHierarchy = async (facilityId?: string): Promise<{
    data: {
        admins: User[];
        pharmacists: User[];
        patients: User[];
        assignments: PatientAssignment[];
    };
    error: Error | null;
}> => {
    try {
        let adminQuery = supabase.from('profiles').select('*').eq('role', 'admin');
        let pharmacistQuery = supabase.from('profiles').select('*').in('role', ['pharmacist', 'worker', 'cashier']);
        let patientQuery = supabase.from('profiles').select('*').eq('role', 'customer');
        let assignmentQuery = supabase.from('patient_pharmacist_assignments').select('*').eq('status', 'active');

        if (facilityId) {
            adminQuery = adminQuery.eq('facility_id', facilityId);
            pharmacistQuery = pharmacistQuery.eq('facility_id', facilityId);
            assignmentQuery = assignmentQuery.eq('facility_id', facilityId);
        }

        const [admins, pharmacists, patients, assignments] = await Promise.all([
            adminQuery,
            pharmacistQuery,
            patientQuery,
            assignmentQuery,
        ]);

        return {
            data: {
                admins: admins.data as User[] || [],
                pharmacists: pharmacists.data as User[] || [],
                patients: patients.data as User[] || [],
                assignments: assignments.data as PatientAssignment[] || [],
            },
            error: null,
        };
    } catch (err) {
        console.error('Error fetching user hierarchy:', err);
        return {
            data: { admins: [], pharmacists: [], patients: [], assignments: [] },
            error: err as Error,
        };
    }
};

export default {
    assignPatientToPharmacist,
    unassignPatient,
    getPatientsByPharmacist,
    getPharmacistsByPatient,
    getStaffByAdmin,
    setPharmacistManager,
    getPharmacistsByManager,
    getPharmacistMetrics,
    getAdminMetrics,
    getPlatformMetrics,
    getUsersByRole,
    getUserHierarchy,
};
