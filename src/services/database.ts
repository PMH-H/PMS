
// =====================================================
// DATABASE SERVICE LAYER
// =====================================================
import { supabase } from './supabase';
import type {
    Drug, DrugBatch, Sale, SaleItem, InventoryAdjustment,
    AuditLog, SearchLog, User, Notification, Prescription, PatientAllergy, PlatformMetrics
} from '../types';

// =====================================================
// ITEMS (DRUGS)
// =====================================================
export const getItems = async (facilityId?: string) => {
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (error) throw error;
    return data || [];
};

export const createItem = async (item: Partial<Drug>) => {
    const { data, error } = await supabase.from('items').insert([item]).select().single();
    if (error) throw error;
    return data;
};

export const updateItem = async (id: string, updates: Partial<Drug>) => {
    const { data, error } = await supabase.from('items').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};



// ... (other item functions are correct)

// =====================================================
// ITEM BATCHES
// =====================================================
export const getBatches = async ({ facilityId, itemId }: { facilityId: string, itemId?: string }) => {
    let query = supabase.from('item_batches').select('*, items(id, name, sku, unit)').eq('facility_id', facilityId);
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
    console.log('Fetching prescriptions for', { userId, facilityId });
    let query;

    if (facilityId) {
        // Current Schema does not link Rx to Facility directly.
        // Return all prescriptions so Pharmacist can view/claim them.
        // In future: Filter by 'dispensary_id' or checking if patient belongs to facility.
        query = supabase
            .from('prescriptions')
            .select('*, patient:profiles!prescriptions_patient_id_fkey(full_name)');
    } else {
        // Standard query, optionally filtered by patient_id
        query = supabase
            .from('prescriptions')
            // Optimize: select specific fields if possible, but for now stick to * for compat
            .select('*, patient:profiles!prescriptions_patient_id_fkey(full_name)');
        if (userId) {
            query = query.eq('patient_id', userId);
        }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching prescriptions:', error);
        throw error; // Throw so cache doesn't store empty result
    }
    return data || [];
};

export const getSalesSummary = async (facilityId: string, limit: number = 50) => {
    const { data, error } = await supabase
        .from('sales')
        .select('id, total_price, created_at, sold_by_user_id, customer_info, items')
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
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

export const getAuditLogs = async (
    options: {
        entityId?: string;
        entityType?: string;
        userId?: string;
        action?: string;
        limit?: number;
    }
) => {
    let query = supabase
        .from('audit_log')
        .select(`
            *,
            *,
            profiles:performed_by (
                full_name,
                role
            )
        `)
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

    if (options.entityId) query = query.eq('record_id', options.entityId);
    if (options.entityType) query = query.eq('table_name', options.entityType);
    if (options.userId) query = query.eq('performed_by', options.userId);
    if (options.action) query = query.eq('action', options.action);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const processSale = async (facilityId: string, items: SaleItem[], customerInfo?: string) => {
    const totalPrice = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const { data: sale, error: saleError } = await supabase.from('sales').insert([{ facility_id: facilityId, items: items, total_price: totalPrice, customer_info: customerInfo }]).select().single();
    if (saleError) throw saleError;
    // FEFO Logic for stock update would go here...
    return sale;
};

// =============================================
// PATIENT ALLERGIES
// =============================================
export const getPatientAllergies = async (patientId: string) => {
    const { data, error } = await supabase
        .from('patient_allergies')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'ACTIVE') // Only active allergies
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const addPatientAllergy = async (allergy: Partial<PatientAllergy>) => {
    const payload = { ...allergy, status: 'ACTIVE' };
    const { data, error } = await supabase
        .from('patient_allergies')
        .insert([payload])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const removePatientAllergy = async (id: string) => {
    const { error } = await supabase
        .from('patient_allergies')
        .update({ status: 'INACTIVE' })
        .eq('id', id);
    if (error) throw error;
};

// =============================================
// RIDERS & DELIVERY MANAGEMENT
// =============================================

export const getRiders = async (facilityId: string) => {
    const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('facility_id', facilityId)
        .order('full_name');
    if (error) throw error;
    return data || [];
};

export const getRiderById = async (riderId: string) => {
    const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('id', riderId)
        .single();
    if (error) throw error;
    return data;
};

export const createRider = async (rider: any) => {
    const { data, error } = await supabase
        .from('riders')
        .insert([rider])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateRider = async (riderId: string, updates: any) => {
    const { data, error } = await supabase
        .from('riders')
        .update(updates)
        .eq('id', riderId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateRiderLocation = async (riderId: string, latitude: number, longitude: number) => {
    const { data, error } = await supabase
        .from('riders')
        .update({
            current_location: { latitude, longitude, timestamp: new Date().toISOString() }
        })
        .eq('id', riderId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const getDeliveries = async (facilityId?: string, status?: string) => {
    let query = supabase.from('customer_orders').select('*');

    if (facilityId) {
        query = query.eq('facility_id', facilityId);
    }
    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getDeliveryById = async (deliveryId: string) => {
    const { data, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', deliveryId)
        .single();
    if (error) throw error;
    return data;
};

export const createDelivery = async (delivery: any) => {
    const { data, error } = await supabase
        .from('customer_orders')
        .insert([delivery])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateDelivery = async (deliveryId: string, updates: any) => {
    const { data, error } = await supabase
        .from('customer_orders')
        .update(updates)
        .eq('id', deliveryId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const assignDeliveryToRider = async (deliveryId: string, riderId: string) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('customer_orders')
        .update({
            assigned_to: riderId,
            status: 'ASSIGNED',
            updated_at: now
        })
        .eq('id', deliveryId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const getUnassignedDeliveries = async (facilityId: string) => {
    const { data, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('assigned_to', null)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const getRiderDeliveries = async (riderId: string) => {
    const { data, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('assigned_to', riderId)
        .in('status', ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'])
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
};

// =====================================================
// STORE PRODUCTS - CRUD OPERATIONS
// =====================================================

export const getStoreProducts = async (facilityId: string, filters?: any) => {
    let query = supabase
        .from('store_products')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (filters?.category) {
        query = query.eq('category', filters.category);
    }
    if (filters?.searchTerm) {
        query = query.or(`name.ilike.%${filters.searchTerm}%,tags.cs.{"${filters.searchTerm}"}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const getStoreProductById = async (productId: string) => {
    const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', productId)
        .single();
    if (error) throw error;
    return data;
};

export const createStoreProduct = async (product: any) => {
    const { data, error } = await supabase
        .from('store_products')
        .insert([{
            ...product,
            created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateStoreProduct = async (productId: string, updates: any) => {
    const { data, error } = await supabase
        .from('store_products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteStoreProduct = async (productId: string) => {
    const { data, error } = await supabase
        .from('store_products')
        .update({ is_active: false })
        .eq('id', productId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

// =====================================================
// STORE ORDERS - CRUD OPERATIONS
// =====================================================

export const getStoreOrders = async (facilityId?: string, customerId?: string) => {
    let query = supabase
        .from('store_orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (facilityId) {
        query = query.eq('facility_id', facilityId);
    }
    if (customerId) {
        query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const createStoreOrder = async (order: any) => {
    const { data, error } = await supabase
        .from('store_orders')
        .insert([order])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateStoreOrderStatus = async (orderId: string, status: string) => {
    const { data, error } = await supabase
        .from('store_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

// =====================================================
// NOTIFICATIONS - CRUD OPERATIONS
// =====================================================

export const getUserNotifications = async (userId: string, unreadOnly?: boolean) => {
    let query = supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (unreadOnly) {
        query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const createNotification = async (notification: any) => {
    const { data, error } = await supabase
        .from('user_notifications')
        .insert([notification])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const markNotificationAsRead = async (notificationId: string) => {
    const { data, error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const getNotificationPreferences = async (userId: string) => {
    const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error?.code === 'PGRST116') {
        // Row not found, create default preferences
        return await createNotificationPreferences(userId);
    }
    if (error) throw error;
    return data;
};

export const createNotificationPreferences = async (userId: string) => {
    const { data, error } = await supabase
        .from('notification_preferences')
        .insert([{ user_id: userId }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateNotificationPreferences = async (userId: string, preferences: any) => {
    const { data, error } = await supabase
        .from('notification_preferences')
        .update({ ...preferences, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

// =====================================================
// HEALTH ARTICLES - CRUD OPERATIONS
// =====================================================

export const getHealthArticles = async (facilityId: string, publishedOnly?: boolean) => {
    let query = supabase
        .from('health_articles')
        .select('*')
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

    if (publishedOnly) {
        query = query.eq('is_published', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const getHealthArticleById = async (articleId: string) => {
    const { data, error } = await supabase
        .from('health_articles')
        .select('*')
        .eq('id', articleId)
        .single();
    if (error) throw error;
    return data;
};

export const createHealthArticle = async (article: any) => {
    const { data, error } = await supabase
        .from('health_articles')
        .insert([article])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateHealthArticle = async (articleId: string, updates: any) => {
    const { data, error } = await supabase
        .from('health_articles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', articleId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteHealthArticle = async (articleId: string) => {
    const { data, error } = await supabase
        .from('health_articles')
        .delete()
        .eq('id', articleId);
    if (error) throw error;
    return data;
};

// =====================================================
// USER CHANNELS - CRUD OPERATIONS
// =====================================================

export const getUserChannels = async (facilityId?: string) => {
    let query = supabase
        .from('user_channels')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (facilityId) {
        query = query.eq('facility_id', facilityId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const getChannelById = async (channelId: string) => {
    const { data, error } = await supabase
        .from('user_channels')
        .select('*')
        .eq('id', channelId)
        .single();
    if (error) throw error;
    return data;
};

export const createUserChannel = async (channel: any) => {
    const { data, error } = await supabase
        .from('user_channels')
        .insert([channel])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateUserChannel = async (channelId: string, updates: any) => {
    const { data, error } = await supabase
        .from('user_channels')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', channelId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

// =====================================================
// CHANNEL MEMBERSHIPS
// =====================================================

export const getChannelMembers = async (channelId: string) => {
    const { data, error } = await supabase
        .from('channel_memberships')
        .select('*, profiles(id, full_name, avatar_url)')
        .eq('channel_id', channelId)
        .order('joined_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const addChannelMember = async (channelId: string, userId: string, role: string = 'MEMBER') => {
    const { data, error } = await supabase
        .from('channel_memberships')
        .insert([{ channel_id: channelId, user_id: userId, role }])
        .select()
        .single();
    if (error) throw error;

    // Update member count
    await updateUserChannel(channelId, {
        member_count: (await getChannelMembers(channelId)).length
    });

    return data;
};

export const removeChannelMember = async (channelId: string, userId: string) => {
    const { error } = await supabase
        .from('channel_memberships')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);
    if (error) throw error;

    // Update member count
    await updateUserChannel(channelId, {
        member_count: (await getChannelMembers(channelId)).length
    });
};

export const getUserChannelsForMember = async (userId: string) => {
    const { data, error } = await supabase
        .from('channel_memberships')
        .select('*, user_channels(*)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

// =====================================================
// CHANNEL MESSAGES
// =====================================================

export const getChannelMessages = async (channelId: string, limit: number = 50) => {
    const { data, error } = await supabase
        .from('channel_messages')
        .select('*, profiles(id, full_name, avatar_url)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []).reverse(); // Return in ascending order for display
};

export const sendChannelMessage = async (channelId: string, message: string, mediaUrl?: string) => {
    const { data, error } = await supabase
        .from('channel_messages')
        .insert([{
            channel_id: channelId,
            sender_id: (await supabase.auth.getUser()).data.user?.id,
            message,
            media_url: mediaUrl
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

// =====================================================
// BROADCASTS
// =====================================================

export const createBroadcast = async (broadcast: any) => {
    const { data, error } = await supabase
        .from('broadcasts')
        .insert([{
            ...broadcast,
            sender_id: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const getChannelBroadcasts = async (channelId: string) => {
    const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const updateBroadcast = async (broadcastId: string, updates: any) => {
    const { data, error } = await supabase
        .from('broadcasts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', broadcastId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const sendBroadcast = async (broadcastId: string) => {
    const { data, error } = await supabase
        .from('broadcasts')
        .update({
            delivery_status: 'SENT',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', broadcastId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

// =====================================================
// METRICS - RETRIEVE OPERATIONS
// =====================================================

export const getStoreMetrics = async (facilityId: string, dateRange?: { from: string; to: string }) => {
    let query = supabase
        .from('store_metrics')
        .select('*')
        .eq('facility_id', facilityId)
        .order('date', { ascending: false });

    if (dateRange) {
        query = query.gte('date', dateRange.from).lte('date', dateRange.to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const getChannelMetrics = async (channelId: string, dateRange?: { from: string; to: string }) => {
    let query = supabase
        .from('channel_metrics')
        .select('*')
        .eq('channel_id', channelId)
        .order('date', { ascending: false });

    if (dateRange) {
        query = query.gte('date', dateRange.from).lte('date', dateRange.to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const getSystemMetrics = async (facilityId: string, dateRange?: { from: string; to: string }): Promise<PlatformMetrics[]> => {
    let query = supabase
        .from('platform_metrics')
        .select('*')
        .eq('facility_id', facilityId)
        .order('date', { ascending: false });

    if (dateRange) {
        query = query.gte('date', dateRange.from).lte('date', dateRange.to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

// REPORTS & ANALYTICS
// =====================================================

export const getInventoryValuation = async (facilityId: string) => {
    const { data, error } = await supabase.rpc('get_inventory_valuation', { p_facility_id: facilityId });
    if (error) throw error;
    return data as any[]; // Row[]: total_cost_value, total_retail_value, item_count, batch_count
};

export const getExpiryRiskReport = async (facilityId: string, daysCallback: number = 90) => {
    const { data, error } = await supabase.rpc('get_expiry_risk_report', {
        p_facility_id: facilityId,
        p_days: daysCallback
    });
    if (error) throw error;
    return data as any[];
};

export const getPeriodSalesReport = async (facilityId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase.rpc('get_period_sales_report', {
        p_facility_id: facilityId,
        p_start_date: startDate,
        p_end_date: endDate
    });
    if (error) throw error;
    return data as any[];
};
