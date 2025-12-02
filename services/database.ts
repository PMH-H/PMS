
// =====================================================
// DATABASE SERVICE LAYER
// =====================================================
import { supabase } from './supabase';
import type {
    Drug, DrugBatch, Sale, SaleItem, InventoryAdjustment,
    AuditLog, SearchLog, User, Notification, Prescription
} from '../types';

// =====================================================
// ITEMS (DRUGS)
// =====================================================
export const getItems = async (facilityId?: string) => {
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (error) throw error;
    return data || [];
};

// ... (other item functions are correct)

// =====================================================
// ITEM BATCHES
// =====================================================
export const getBatches = async ({ facilityId, itemId }: { facilityId: string, itemId?: string }) => {
    let query = supabase.from('item_batches').select('*, items(*)').eq('facility_id', facilityId);
    if (itemId) {
        query = query.eq('item_id', itemId);
    }
    const { data, error } = await query.order('expiry_date');
    if (error) throw error;
    return data || [];
};

// ... (other batch and stock functions are correct)

// =====================================================
// PRESCRIPTIONS & ALERTS
// =====================================================

/**
 * Fetches prescriptions, optionally filtering by user ID or facility ID.
 * @param userId - The ID of the patient to fetch prescriptions for.
 * @param facilityId - The ID of the facility to fetch prescriptions for.
 *                   If facilityId is provided, the query will join with profiles
 *                   and filter prescriptions belonging to users in that facility.
 */
export const getPrescriptions = async (userId?: string, facilityId?: string) => {
    let query;

    if (facilityId) {
        // To filter by facility, we must join with profiles and filter on the joined table.
        query = supabase
            .from('prescriptions')
            .select('*, profiles!prescriptions_patient_id_fkey!inner(full_name)') // !inner ensures we only get prescriptions with a profile.
            .eq('profiles.facility_id', facilityId); // Filter on the joined profiles table.
    } else {
        // Standard query, optionally filtered by patient_id
        query = supabase
            .from('prescriptions')
            .select('*, profiles!prescriptions_patient_id_fkey(full_name)'); // Regular join to get patient name
        if (userId) {
            query = query.eq('patient_id', userId);
        }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching prescriptions:", error);
        return []; // Return empty array on error to prevent crashes
    }

    return data || [];
};


export const createPrescription = async (prescription: Partial<Prescription> & { patient_id: string }) => {
    const { data, error } = await supabase.from('prescriptions').insert([prescription]).select().single();
    if (error) throw error;
    return data;
};

export const updatePrescriptionStatus = async (id: string, status: string) => {
    const { data, error } = await supabase.from('prescriptions').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const getStockAlerts = async (facilityId: string, unreadOnly: boolean = false) => {
    let query = supabase.from('alerts').select('*, items(name)').eq('facility_id', facilityId);
    if (unreadOnly) {
        query = query.eq('is_read', false);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
};

// =====================================================
// LOGGING & OTHER FUNCTIONS
// =====================================================
export const createAuditLog = async (log: Partial<AuditLog>) => {
    const { data, error } = await supabase.from('audit_log').insert([log]);
    if (error) console.error('Error creating audit log:', error);
    return data;
};

export const createSearchLog = async (log: Partial<SearchLog>) => {
    const { data, error } = await supabase.from('search_logs').insert([log]);
    if (error) console.error('Error creating search log:', error);
    return data;
};

export const processSale = async (facilityId: string, items: SaleItem[], customerInfo?: string) => {
    const totalPrice = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const { data: sale, error: saleError } = await supabase.from('sales').insert([{ facility_id: facilityId, items: items, total_price: totalPrice, customer_info: customerInfo }]).select().single();
    if (saleError) throw saleError;
    // FEFO Logic for stock update would go here...
    return sale;
};

