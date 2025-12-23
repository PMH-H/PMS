
import { supabase } from './supabase';
import { Drug } from '../types';

export interface CartItem extends Drug {
    quantity: number;
}

export interface OrderDetails {
    customer_id: string;
    facility_id: string; // Currently assume single facility orders for MVP
    items: CartItem[];
    total_price_cents: number;
    delivery_type: 'PICKUP' | 'DELIVERY';
    delivery_address?: string;
    delivery_notes?: string;
    notes?: string;
}

export const checkoutService = {
    /**
     * Submit a new order to the store_orders table
     */
    submitOrder: async (order: OrderDetails) => {
        // Validate payload
        if (!order.items.length) throw new Error("Cart is empty");
        if (!order.facility_id) throw new Error("Facility ID missing from order");

        // Construct payload matching schema
        // Note: items is stored as JSONB
        const payload = {
            customer_id: order.customer_id,
            facility_id: order.facility_id,
            items: order.items.map(item => ({
                item_id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit_price: item.price_cents || 0,
                // We keep basic info in JSON for snapshot
            })),
            total_price_cents: order.total_price_cents,
            status: 'PENDING',
            delivery_type: order.delivery_type,
            delivery_address: order.delivery_address || null,
            delivery_notes: order.delivery_notes || null,
            notes: order.notes || null,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('store_orders')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get orders for the current user
     */
    getMyOrders: async (userId: string) => {
        const { data, error } = await supabase
            .from('store_orders')
            .select('*')
            .eq('customer_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
};
