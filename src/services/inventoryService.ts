
import { supabase } from './supabase';
import { InventoryItem, InventoryTransaction, Batch, StockAlert, NetworkInventoryItem } from '../types';

export const inventoryService = {
    /**
     * Get inventory items for the whole network (Recursive)
     */
    getNetworkInventory: async (rootFacilityId: string) => {
        const { data, error } = await supabase.rpc('get_network_inventory', { p_root_facility_id: rootFacilityId });
        if (error) throw error;
        return data as NetworkInventoryItem[];
    },

    /**
     * Transfer stock between facilities
     */
    transferStock: async (fromId: string, toId: string, itemId: string, quantity: number, userId: string) => {
        const { error } = await supabase.rpc('transfer_stock', {
            p_from_facility_id: fromId,
            p_to_facility_id: toId,
            p_item_id: itemId,
            p_quantity: quantity,
            p_user_id: userId
        });
        if (error) throw error;
    },

    /**
     * Get hierarchy helpers to list child facilities
     */
    getChildFacilities: async (facilityId: string) => {
        const { data, error } = await supabase.rpc('get_child_facilities', { p_facility_id: facilityId });
        if (error) throw error;
        return data;
    },

    /**
     * Standard get Inventory (for single facility) - wrapping db call logic here if we were refactoring fully, 
     * but for now we focus on the new features.
     */
};
