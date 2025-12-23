import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    User,
    UserRole,
    Prescription,
    Drug,
    DrugBatch,
    Sale,
    InventoryItem,
    AdminMetricsSummary
} from '../types';
import { getItems, getBatches, getPrescriptions, getStockAlerts, getSalesSummary, getStoreProducts } from '../services/database';
import { fetchWithCache } from '../utils/cache';

export interface DashboardData {
    prescriptions: Prescription[];
    inventory: Drug[];
    batches: DrugBatch[];
    sales: Sale[];
    adminMetrics: AdminMetricsSummary | null;
    notifications: any[]; // Typed loosely here, handled by Context mainly
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useDashboardData = (user: User | null) => {
    const [data, setData] = useState<DashboardData>({
        prescriptions: [],
        inventory: [],
        batches: [],
        sales: [],
        adminMetrics: null,
        notifications: [],
        loading: true,
        error: null
    });

    const fetchData = useCallback(async (forceRefresh = false) => {
        if (!user) return;

        // Don't set loading on background refresh (polling)
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            // console.log(`Fetching dashboard data (Force: ${forceRefresh})`);
        }

        if (forceRefresh) {
            // Clear relevant cache keys to force fresh fetch
            localStorage.removeItem(`pharmai_cache_rx_p_${user.id}`);
            localStorage.removeItem(`pharmai_cache_rx_f_${user.facility_id}`);
            localStorage.removeItem(`pharmai_cache_batch_${user.facility_id}`);
            localStorage.removeItem(`pharmai_cache_sales_${user.facility_id}`);
            localStorage.removeItem(`pharmai_cache_inv_${user.facility_id}`);
        }

        try {
            const results: Partial<DashboardData> = {};
            const promises: Promise<any>[] = [];

            // 2. ROLE SPECIFIC DATA
            switch (user.role) {
                case UserRole.CUSTOMER: {
                    // Cache prescriptions for 15s (Polling target)
                    const rxPromise = fetchWithCache(`rx_p_${user.id}`, () => getPrescriptions(user.id), 15000)
                        .then(r => results.prescriptions = (r || []).map((p: any) => ({
                            ...p,
                            patientName: p.patient?.full_name || 'Unknown Patient'
                        })));
                    // Cache drug catalog for 60 mins (very static)
                    const drugsPromise = fetchWithCache('public_items', () => getItems(), 60 * 60 * 1000)
                        .then(r => results.inventory = r || []);
                    promises.push(rxPromise, drugsPromise);
                    break;
                }

                case UserRole.PHARMACIST:
                case UserRole.ADMIN: // Facility Admin
                case UserRole.WORKER:
                case UserRole.CASHIER: {
                    if (user.facility_id) {
                        // Inventory: Cache for 5 mins (Less volatile than Rx)
                        const p1 = Promise.all([
                            fetchWithCache(`inv_${user.facility_id}`, () => getItems(), 5 * 60 * 1000),
                            fetchWithCache(`store_prod_${user.facility_id}`, () => getStoreProducts(user.facility_id!), 5 * 60 * 1000)
                        ]).then(([globalItems, storeItems]) => {
                            const mappedStoreItems: Drug[] = (storeItems || []).map((s: any) => ({
                                id: s.id,
                                name: s.name,
                                description: s.description,
                                manufacturer: 'Store Product',
                                type: s.category || 'OTC',
                                unit: 'unit',
                                image_url: s.image_url,
                                created_at: s.created_at,
                                updated_at: s.updated_at
                            } as Drug));
                            results.inventory = [...(globalItems || []), ...mappedStoreItems];
                        });

                        // Batches: Cache for 1 min (updates with sales)
                        const p2 = fetchWithCache(`batch_${user.facility_id}`, () => getBatches({ facilityId: user.facility_id! }), 60000)
                            .then(r => results.batches = r || []);

                        // Sales: Cache for 2 mins
                        const p3 = fetchWithCache(`sales_${user.facility_id}`, () => getSalesSummary(user.facility_id!), 2 * 60 * 1000)
                            .then(r =>
                                results.sales = (r as any[]).map(s => ({ ...s, items: s.items || [] })) || []
                            );

                        // Facility Prescriptions: reduced to 15s (Near-Realtime Polling)
                        const p4 = fetchWithCache(`rx_f_${user.facility_id}`, () => getPrescriptions(undefined, user.facility_id), 15000)
                            .then(r => results.prescriptions = (r || []).map((p: any) => ({
                                ...p,
                                patientName: p.patient?.full_name || 'Unknown Patient'
                            })));

                        promises.push(p1, p2, p3, p4);
                    }
                    break;
                }

                case UserRole.PRESCRIBER: {
                    results.loading = false;
                    break;
                }

                case UserRole.SUPER_ADMIN_BMS:
                case UserRole.SUPER_ADMIN_DEV: {
                    // Admin Metrics: Cache for 5 mins
                    const p1 = fetchWithCache('admin_metrics_summary', async () => {
                        const { data, error } = await supabase.from('admin_metrics_summary').select('*').single();
                        if (error) throw error;
                        return data as AdminMetricsSummary;
                    }, 5 * 60 * 1000).then(data => {
                        if (data) results.adminMetrics = data;
                    });

                    promises.push(p1);
                    break;
                }
            }

            await Promise.allSettled(promises);

            setData(prev => ({
                ...prev,
                ...results,
                loading: false
            }));

        } catch (err: any) {
            console.error("Dashboard data fetch error:", err);
            setData(prev => ({ ...prev, loading: false, error: err.message }));
        }
    }, [user]);

    // Initial Fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Setup Polling (every 30 seconds) to ensure lists stay relatively fresh without Realtime
    useEffect(() => {
        if (!user) return;
        const intervalId = setInterval(() => {
            // forceRefresh=true ensures we bypass the cache if it's stale (or we explicitly just rely on TTL expiration)
            // actually, better to let fetchWithCache decide based on TTL (15s). 
            // If we forceRefresh every 30s, we guarantee a network call.
            fetchData(true);
        }, 30000);

        return () => clearInterval(intervalId);
    }, [user, fetchData]);

    return { ...data, refresh: async () => fetchData(true) };
};
