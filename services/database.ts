// =====================================================
// DATABASE SERVICE LAYER
// =====================================================
// Centralized database operations for PharmAI
// All Supabase queries go through this service
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
    let query = supabase
        .from('items')
        .select('*')
        .order('name');

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

export const getItemById = async (itemId: string) => {
    const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

    if (error) throw error;
    return data;
};

export const searchItems = async (searchTerm: string) => {
    const { data, error } = await supabase
        .from('items')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,generic_name.ilike.%${searchTerm}%,barcode.eq.${searchTerm}`)
        .limit(20);

    if (error) throw error;
    return data;
};

export const createItem = async (item: Partial<Drug>) => {
    const { data, error } = await supabase
        .from('items')
        .insert([item])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateItem = async (itemId: string, updates: Partial<Drug>) => {
    const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// =====================================================
// ITEM BATCHES
// =====================================================

export const getBatches = async (facilityId: string, itemId?: string) => {
    let query = supabase
        .from('item_batches')
        .select('*, items(*)')
        .eq('facility_id', facilityId);

    if (itemId) {
        query = query.eq('item_id', itemId);
    }

    const { data, error } = await query.order('expiry_date');
    if (error) throw error;
    return data;
};

export const addBatch = async (batch: Partial<DrugBatch> & { facility_id: string }) => {
    const { data, error } = await supabase
        .from('item_batches')
        .insert([batch])
        .select()
        .single();

    if (error) throw error;

    // Also record stock movement
    await recordStockMovement({
        item_id: batch.drug_id!,
        batch_id: data.id,
        facility_id: batch.facility_id,
        movement_type: 'IN',
        quantity: batch.received_units!,
        unit_price: batch.cost_per_unit,
        reason: `Initial batch receipt: ${batch.batch_no}`
    });

    return data;
};

export const updateBatchQuantity = async (
    batchId: string,
    newQuantity: number,
    reason: string
) => {
    const { data: batch, error: fetchError } = await supabase
        .from('item_batches')
        .select('*')
        .eq('id', batchId)
        .single();

    if (fetchError) throw fetchError;

    const quantityChange = newQuantity - batch.current_quantity;

    const { data, error } = await supabase
        .from('item_batches')
        .update({ current_quantity: newQuantity })
        .eq('id', batchId)
        .select()
        .single();

    if (error) throw error;

    // Record adjustment
    await recordStockMovement({
        item_id: batch.item_id,
        batch_id: batchId,
        facility_id: batch.facility_id,
        movement_type: quantityChange > 0 ? 'ADJUST_UP' : 'ADJUST_DOWN',
        quantity: Math.abs(quantityChange),
        reason
    });

    return data;
};

// =====================================================
// STOCK MOVEMENTS
// =====================================================

export const recordStockMovement = async (movement: {
    item_id: string;
    batch_id?: string;
    facility_id: string;
    movement_type: string;
    quantity: number;
    unit_price?: number;
    reason?: string;
    reference_id?: string;
}) => {
    const { data, error } = await supabase
        .from('stock_movements')
        .insert([movement])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getStockHistory = async (
    facilityId: string,
    itemId?: string,
    limit: number = 50
) => {
    let query = supabase
        .from('stock_movements')
        .select('*, items(name), item_batches(batch_no), profiles(full_name)')
        .eq('facility_id', facilityId);

    if (itemId) {
        query = query.eq('item_id', itemId);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
};

// =====================================================
// SALES
// =====================================================

export const processSale = async (
    facilityId: string,
    items: SaleItem[],
    customerInfo?: string
) => {
    // Start a transaction-like process
    // 1. Create sale record
    const totalPrice = items.reduce((sum, item) => sum + (item.units * item.unit_price), 0);

    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
            facility_id: facilityId,
            items: items,
            total_price: totalPrice,
            customer_info: customerInfo
        }])
        .select()
        .single();

    if (saleError) throw saleError;

    // 2. Update batches and record movements (FEFO logic)
    for (const item of items) {
        let remainingUnits = item.units;

        if (item.batch_id) {
            // Specific batch
            const { data: batch } = await supabase
                .from('item_batches')
                .select('*')
                .eq('id', item.batch_id)
                .single();

            if (!batch || batch.current_quantity < remainingUnits) {
                throw new Error(`Insufficient stock in batch ${item.batch_id}`);
            }

            await supabase
                .from('item_batches')
                .update({ current_quantity: batch.current_quantity - remainingUnits })
                .eq('id', item.batch_id);

            await recordStockMovement({
                item_id: item.drug_id,
                batch_id: item.batch_id,
                facility_id: facilityId,
                movement_type: 'OUT',
                quantity: remainingUnits,
                unit_price: item.unit_price,
                reference_id: sale.id,
                reason: 'Sale'
            });
        } else {
            // FEFO: Get batches sorted by expiry
            const { data: batches } = await supabase
                .from('item_batches')
                .select('*')
                .eq('item_id', item.drug_id)
                .eq('facility_id', facilityId)
                .gt('current_quantity', 0)
                .order('expiry_date');

            if (!batches || batches.reduce((sum, b) => sum + b.current_quantity, 0) < remainingUnits) {
                throw new Error(`Insufficient stock for item ${item.drug_id}`);
            }

            for (const batch of batches) {
                if (remainingUnits <= 0) break;

                const take = Math.min(batch.current_quantity, remainingUnits);

                await supabase
                    .from('item_batches')
                    .update({ current_quantity: batch.current_quantity - take })
                    .eq('id', batch.id);

                await recordStockMovement({
                    item_id: item.drug_id,
                    batch_id: batch.id,
                    facility_id: facilityId,
                    movement_type: 'OUT',
                    quantity: take,
                    unit_price: item.unit_price,
                    reference_id: sale.id,
                    reason: 'Sale'
                });

                remainingUnits -= take;
            }
        }
    }

    return sale;
};

export const getSales = async (facilityId: string, limit: number = 50) => {
    const { data, error } = await supabase
        .from('sales')
        .select('*, profiles(full_name)')
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
};

// =====================================================
// CYCLE COUNTS
// =====================================================

export const createCycleCount = async (
    facilityId: string,
    scheduledDate: string,
    assignedTo?: string
) => {
    const { data, error } = await supabase
        .from('cycle_counts')
        .insert([{
            facility_id: facilityId,
            scheduled_date: scheduledDate,
            assigned_to: assignedTo,
            status: 'SCHEDULED'
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const submitCycleCountResult = async (
    cycleCountId: string,
    itemId: string,
    batchId: string | null,
    systemQuantity: number,
    countedQuantity: number,
    notes?: string
) => {
    const variance = countedQuantity - systemQuantity;
    const variancePercentage = systemQuantity > 0
        ? ((variance / systemQuantity) * 100)
        : 0;

    const { data, error } = await supabase
        .from('cycle_count_results')
        .insert([{
            cycle_count_id: cycleCountId,
            item_id: itemId,
            batch_id: batchId,
            system_quantity: systemQuantity,
            counted_quantity: countedQuantity,
            variance_percentage: variancePercentage,
            notes
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const approveCycleCount = async (cycleCountId: string) => {
    // 1. Update cycle count status
    const { error: updateError } = await supabase
        .from('cycle_counts')
        .update({ status: 'APPROVED', completed_date: new Date().toISOString() })
        .eq('id', cycleCountId);

    if (updateError) throw updateError;

    // 2. Get all results
    const { data: results } = await supabase
        .from('cycle_count_results')
        .select('*')
        .eq('cycle_count_id', cycleCountId);

    // 3. Apply adjustments
    if (results) {
        for (const result of results) {
            if (result.variance !== 0 && result.batch_id) {
                await updateBatchQuantity(
                    result.batch_id,
                    result.counted_quantity,
                    `Cycle count adjustment (Count ID: ${cycleCountId})`
                );
            }
        }
    }

    return true;
};

// =====================================================
// AUDIT LOGS
// =====================================================

export const createAuditLog = async (log: Partial<AuditLog>) => {
    const { data, error } = await supabase
        .from('audit_log')
        .insert([log])
        .select()
        .single();

    if (error) {
        console.error('Error creating audit log:', error);
        // Don't throw, just log error to avoid blocking main flow
        return null;
    }
    return data;
};

// =====================================================
// PURCHASE ORDERS
// =====================================================

export const createPO = async (
    facilityId: string,
    supplierId: string,
    items: Array<{ item_id: string; quantity: number; unit_price: number }>
) => {
    const poNumber = `PO-${Date.now()}`;
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
            po_number: poNumber,
            supplier_id: supplierId,
            facility_id: facilityId,
            status: 'DRAFT',
            order_date: new Date().toISOString(),
            total_amount: totalAmount
        }])
        .select()
        .single();

    if (poError) throw poError;

    // Add line items
    const lineItems = items.map(item => ({
        po_id: po.id,
        item_id: item.item_id,
        quantity_ordered: item.quantity,
        unit_price: item.unit_price
    }));

    const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(lineItems);

    if (itemsError) throw itemsError;

    return po;
};

export const updatePOStatus = async (poId: string, status: string) => {
    const { data, error } = await supabase
        .from('purchase_orders')
        .update({ status })
        .eq('id', poId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// =====================================================
// ANALYTICS
// =====================================================

export const getInventoryMetrics = async (facilityId: string) => {
    const { data, error } = await supabase
        .from('inventory_analytics')
        .select('*')
        .eq('facility_id', facilityId)
        .order('period_end', { ascending: false })
        .limit(1);

    if (error) throw error;
    return data?.[0] || null;
};

export const getStockAlerts = async (facilityId: string, unreadOnly: boolean = false) => {
    let query = supabase
        .from('alerts')
        .select('*, items(name)')
        .eq('facility_id', facilityId);

    if (unreadOnly) {
        query = query.eq('is_read', false);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw error;
    return data;
};

export const createAlert = async (alert: {
    facility_id: string;
    type: string;
    message: string;
    item_id?: string;
}) => {
    const { data, error } = await supabase
        .from('alerts')
        .insert([{
            ...alert,
            is_read: false,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating alert:', error);
        return null;
    }
    return data;
};

export const markAlertAsRead = async (alertId: string) => {
    const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

    if (error) throw error;
};

// =====================================================
// PRESCRIPTIONS
// =====================================================

export const getPrescriptions = async (userId?: string) => {
    let query = supabase
        .from('prescriptions')
        .select('*')
        .order('created_at', { ascending: false });

    if (userId) {
        query = query.eq('patient_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

export const createPrescription = async (prescription: Partial<Prescription> & { patient_id: string }) => {
    // Map frontend Prescription type to DB schema
    // DB: id, patient_id, status, image_url, medications (jsonb), interactions (jsonb)

    const dbPayload = {
        id: prescription.id,
        patient_id: prescription.patient_id,
        status: prescription.status,
        image_url: prescription.imageUrl, // Note: camelCase to snake_case mapping if needed, but DB has image_url
        medications: prescription.medications,
        interactions: prescription.interactions
    };

    const { data, error } = await supabase
        .from('prescriptions')
        .insert([dbPayload])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updatePrescriptionStatus = async (id: string, status: string) => {
    const { data, error } = await supabase
        .from('prescriptions')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// =====================================================
// EDGE FUNCTIONS
// =====================================================

export const calculateReorder = async (itemId: string, facilityId: string, formulaType?: string) => {
    const { data, error } = await supabase.functions.invoke('reorder-calculator', {
        body: { item_id: itemId, facility_id: facilityId, formula_type: formulaType }
    });

    if (error) throw error;
    return data;
};

export const forecastDemand = async (itemId: string, facilityId: string, horizonDays: number = 30) => {
    const { data, error } = await supabase.functions.invoke('demand-forecast', {
        body: { item_id: itemId, facility_id: facilityId, horizon_days: horizonDays }
    });

    if (error) throw error;
    return data;
};

export const analyzeStockHealth = async (facilityId: string, dateRange?: { start: string; end: string }) => {
    const { data, error } = await supabase.functions.invoke('stock-health-analyzer', {
        body: { facility_id: facilityId, date_range: dateRange }
    });

    if (error) throw error;
    return data;
};
