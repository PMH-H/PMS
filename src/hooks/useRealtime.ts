// =====================================================
// REACT HOOKS FOR SUPABASE REALTIME
// =====================================================
// Custom hooks for real-time subscriptions
// =====================================================

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// =====================================================
// STOCK MOVEMENTS REALTIME
// =====================================================

export const useStockMovements = (facilityId: string) => {
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);

    useEffect(() => {
        // Initial fetch
        const fetchMovements = async () => {
            const { data } = await supabase
                .from('stock_movements')
                .select('*, items(name), item_batches(batch_no), profiles(full_name)')
                .eq('facility_id', facilityId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setMovements(data);
            setLoading(false);
        };

        fetchMovements();

        // Subscribe to changes
        const newChannel = supabase
            .channel(`stock_movements:${facilityId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'stock_movements',
                    filter: `facility_id=eq.${facilityId}`
                },
                (payload) => {
                    setMovements((prev) => [payload.new, ...prev].slice(0, 50));
                }
            )
            .subscribe();

        setChannel(newChannel);

        return () => {
            newChannel.unsubscribe();
        };
    }, [facilityId]);

    return { movements, loading };
};

// =====================================================
// ALERTS REALTIME
// =====================================================

export const useAlerts = (facilityId: string, unreadOnly: boolean = false) => {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);

    useEffect(() => {
        const fetchAlerts = async () => {
            let query = supabase
                .from('alerts')
                .select('*, items(name)')
                .eq('facility_id', facilityId);

            if (unreadOnly) {
                query = query.eq('is_read', false);
            }

            const { data } = await query
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setAlerts(data);
            setLoading(false);
        };

        fetchAlerts();

        // Subscribe to new alerts
        const newChannel = supabase
            .channel(`alerts:${facilityId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'alerts',
                    filter: `facility_id=eq.${facilityId}`
                },
                (payload) => {
                    setAlerts((prev) => [payload.new, ...prev]);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'alerts',
                    filter: `facility_id=eq.${facilityId}`
                },
                (payload) => {
                    setAlerts((prev) =>
                        prev.map((alert) => (alert.id === payload.new.id ? payload.new : alert))
                    );
                }
            )
            .subscribe();

        setChannel(newChannel);

        return () => {
            newChannel.unsubscribe();
        };
    }, [facilityId, unreadOnly]);

    const markAsRead = async (alertId: string) => {
        await supabase
            .from('alerts')
            .update({ is_read: true })
            .eq('id', alertId);
    };

    return { alerts, loading, markAsRead };
};

// =====================================================
// CYCLE COUNTS REALTIME
// =====================================================

export const useCycleCounts = (facilityId: string) => {
    const [cycleCounts, setCycleCounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCycleCounts = async () => {
            const { data } = await supabase
                .from('cycle_counts')
                .select('*, profiles!cycle_counts_assigned_to_fkey(full_name)')
                .eq('facility_id', facilityId)
                .order('scheduled_date', { ascending: false });

            if (data) setCycleCounts(data);
            setLoading(false);
        };

        fetchCycleCounts();

        const channel = supabase
            .channel(`cycle_counts:${facilityId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cycle_counts',
                    filter: `facility_id=eq.${facilityId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setCycleCounts((prev) => [payload.new, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setCycleCounts((prev) =>
                            prev.map((cc) => (cc.id === payload.new.id ? payload.new : cc))
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setCycleCounts((prev) => prev.filter((cc) => cc.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [facilityId]);

    return { cycleCounts, loading };
};

// =====================================================
// PURCHASE ORDERS REALTIME
// =====================================================

export const usePurchaseOrders = (facilityId: string) => {
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPOs = async () => {
            const { data } = await supabase
                .from('purchase_orders')
                .select('*, suppliers(name), profiles!purchase_orders_created_by_fkey(full_name)')
                .eq('facility_id', facilityId)
                .order('order_date', { ascending: false });

            if (data) setPurchaseOrders(data);
            setLoading(false);
        };

        fetchPOs();

        const channel = supabase
            .channel(`purchase_orders:${facilityId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'purchase_orders',
                    filter: `facility_id=eq.${facilityId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setPurchaseOrders((prev) => [payload.new, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setPurchaseOrders((prev) =>
                            prev.map((po) => (po.id === payload.new.id ? payload.new : po))
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setPurchaseOrders((prev) => prev.filter((po) => po.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [facilityId]);

    return { purchaseOrders, loading };
};

// =====================================================
// ITEM BATCHES REALTIME
// =====================================================

export const useItemBatches = (facilityId: string, itemId?: string) => {
    const [batches, setBatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBatches = async () => {
            let query = supabase
                .from('item_batches')
                .select('*, items(*)')
                .eq('facility_id', facilityId);

            if (itemId) {
                query = query.eq('item_id', itemId);
            }

            const { data } = await query.order('expiry_date');

            if (data) setBatches(data);
            setLoading(false);
        };

        fetchBatches();

        const channel = supabase
            .channel(`item_batches:${facilityId}${itemId ? `:${itemId}` : ''}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'item_batches',
                    filter: itemId
                        ? `facility_id=eq.${facilityId},item_id=eq.${itemId}`
                        : `facility_id=eq.${facilityId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setBatches((prev) => [...prev, payload.new].sort((a, b) =>
                            new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
                        ));
                    } else if (payload.eventType === 'UPDATE') {
                        setBatches((prev) =>
                            prev.map((batch) => (batch.id === payload.new.id ? payload.new : batch))
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setBatches((prev) => prev.filter((batch) => batch.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [facilityId, itemId]);

    return { batches, loading };
};
