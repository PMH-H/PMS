import { supabase } from './supabase';
import { DrugBatch, Sale, Notification } from '../types';

/**
 * Real-time Subscriptions Service
 * Handles Supabase Realtime subscriptions for live updates across the app
 */

export interface RealtimeCallbacks {
    onBatchChange?: (batches: DrugBatch[]) => void;
    onSaleAdded?: (sales: Sale[]) => void;
    onNotificationAdded?: (notifications: Notification[]) => void;
}

/**
 * Subscribe to real-time updates for a specific facility
 * Returns cleanup function to unsubscribe
 */
export function subscribeToFacilityUpdates(
    facilityId: string,
    callbacks: RealtimeCallbacks
): () => void {
    console.log('📡 Setting up real-time subscriptions for facility:', facilityId);

    // Subscribe to batch changes (inventory updates)
    const batchChannel = supabase
        .channel('item_batches_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'item_batches',
                filter: `facility_id=eq.${facilityId}`
            },
            (payload) => {
                console.log('📦 Batch change detected:', payload.eventType);

                if (callbacks.onBatchChange) {
                    // Let the callback handle state updates
                    // This way we pass the payload and the component decides how to update
                    const event = payload.eventType;
                    const data = event === 'DELETE' ? payload.old : payload.new;

                    // Dispatch custom event that App.tsx can listen to
                    window.dispatchEvent(new CustomEvent('batch-changed', {
                        detail: { event, data }
                    }));
                }
            }
        )
        .subscribe();

    // Subscribe to sales changes
    const salesChannel = supabase
        .channel('sales_changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'sales',
                filter: `facility_id=eq.${facilityId}`
            },
            (payload) => {
                console.log('💰 New sale detected');

                if (callbacks.onSaleAdded) {
                    window.dispatchEvent(new CustomEvent('sale-added', {
                        detail: payload.new
                    }));
                }
            }
        )
        .subscribe();

    // Subscribe to alerts/notifications
    const alertsChannel = supabase
        .channel('alerts_changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'alerts',
                filter: `facility_id=eq.${facilityId}`
            },
            (payload) => {
                console.log('🔔 New alert received');

                if (callbacks.onNotificationAdded) {
                    window.dispatchEvent(new CustomEvent('notification-added', {
                        detail: payload.new
                    }));
                }
            }
        )
        .subscribe();

    // Return cleanup function
    return () => {
        console.log('🔌 Cleaning up real-time subscriptions');
        supabase.removeChannel(batchChannel);
        supabase.removeChannel(salesChannel);
        supabase.removeChannel(alertsChannel);
    };
}
