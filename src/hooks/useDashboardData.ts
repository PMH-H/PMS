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

    const fetchData = useCallback(async () => {
        if (!user) return;

        setData(prev => ({ ...prev, loading: true, error: null }));

        try {
            const results: Partial<DashboardData> = {};
            const promises: Promise<any>[] = [];

            // 1. GLOBAL / PUBLIC DATA (Everyone needs drugs list? Maybe lazy load, but for now keep)
            // Actually strictly limit by role to improve perf

            // 2. ROLE SPECIFIC DATA
            switch (user.role) {
                case UserRole.CUSTOMER: {
                    // Cache prescriptions for 1 min (somewhat fresh)
                    const rxPromise = fetchWithCache(`rx_p_${user.id}`, () => getPrescriptions(user.id), 60000)
                        .then(r => results.prescriptions = r || []);
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
                        // Inventory: Cache for 5 mins
                        // Fetch both Global Items and Store Products
                        const p1 = Promise.all([
                            fetchWithCache(`inv_${user.facility_id}`, () => getItems(), 5 * 60 * 1000),
                            fetchWithCache(`store_prod_${user.facility_id}`, () => getStoreProducts(user.facility_id!), 5 * 60 * 1000)
                        ]).then(([globalItems, storeItems]) => {
                            // Merge them (map storeItems to match Drug interface if needed, or rely on duck typing for 'id' and 'name')
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

                        // Batches: Cache for 2 mins (changes with sales)
                        const p2 = fetchWithCache(`batch_${user.facility_id}`, () => getBatches({ facilityId: user.facility_id! }), 2 * 60 * 1000)
                            .then(r => results.batches = r || []);

                        // Sales: Cache for 5 mins
                        const p3 = fetchWithCache(`sales_${user.facility_id}`, () => getSalesSummary(user.facility_id!), 5 * 60 * 1000)
                            .then(r =>
                                // Ensure items is an array (it comes from JSONB column)
                                results.sales = (r as any[]).map(s => ({ ...s, items: s.items || [] })) || []
                            );
                        // Facility Prescriptions
                        // Facility Prescriptions: Cache for 1 min (high traffic)
                        const p4 = fetchWithCache(`rx_f_${user.facility_id}`, () => getPrescriptions(undefined, user.facility_id), 60000)
                            .then(r => results.prescriptions = r || []);

                        promises.push(p1, p2, p3, p4);
                    }
                    break;
                }

                case UserRole.PRESCRIBER: {
                    // Prescribers load data dynamically via their specialized dashboard components
                    // To avoid over-fetching, we return minimal initial data here
                    results.loading = false;
                    break;
                }

                case UserRole.SUPER_ADMIN_BMS:
                case UserRole.SUPER_ADMIN_DEV: {
                    // Admin Metrics: Cache for 5 mins
                    // Note: querying directly here, so we wrap the fetcher
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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { ...data, refresh: fetchData };
};
