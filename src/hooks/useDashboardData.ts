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
import { fetchWithCache, getCacheSync } from '../utils/cache';

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
    // Initialize state from cache if available (Stale-While-Revalidate)
    const [data, setData] = useState<DashboardData>(() => {
        if (!user) {
            return {
                prescriptions: [],
                inventory: [],
                batches: [],
                sales: [],
                adminMetrics: null,
                notifications: [],
                loading: true,
                error: null
            };
        }

        // Synchronously load cached data to avoid visual lash
        const cachedInv = getCacheSync<Drug[]>(`inv_${user.facility_id}`) || [];
        const cachedStore = getCacheSync<any[]>(`store_prod_${user.facility_id}`) || [];

        let combinedInventory: Drug[] = [];
        if (cachedInv.length > 0 || cachedStore.length > 0) {
            const mappedStoreItems: Drug[] = cachedStore.map((s: any) => ({
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
            combinedInventory = [...cachedInv, ...mappedStoreItems];
        } else if (user.role === UserRole.CUSTOMER) {
            const publicItems = getCacheSync<Drug[]>('public_items');
            if (publicItems) combinedInventory = publicItems;
        }

        const cachedBatches = getCacheSync<DrugBatch[]>(`batch_${user.facility_id}`) || [];
        const cachedSales = getCacheSync<Sale[]>(`sales_${user.facility_id}`) || [];
        const cachedRx = getCacheSync<Prescription[]>(`rx_f_${user.facility_id}`) ||
            getCacheSync<Prescription[]>(`rx_p_${user.id}`) || [];

        const cachedMetrics = getCacheSync<AdminMetricsSummary>('admin_metrics_summary');

        // If we have critical data, don't show loading spinner
        const hasCriticalData = combinedInventory.length > 0 || cachedRx.length > 0;

        return {
            prescriptions: cachedRx,
            inventory: combinedInventory,
            batches: cachedBatches,
            sales: cachedSales,
            adminMetrics: cachedMetrics,
            notifications: [],
            loading: !hasCriticalData, // Initial loading is false if we have data
            error: null
        };
    });

    const fetchData = useCallback(async (forceRefresh = false) => {
        if (!user) return;

        // Don't set loading on background refresh (polling)
        // Only set loading if we have NO data and this isn't a background refresh
        if (data.inventory.length === 0 && !forceRefresh && data.loading === false) {
            setData(prev => ({ ...prev, loading: true }));
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
                    const p1 = fetchWithCache('admin_metrics', async () => {
                        const { data, error } = await supabase.rpc('get_platform_metrics_summary');
                        if (error) {
                            console.error('Admin metrics error:', error);
                            // Return default metrics on error
                            const { count: pharmacists } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'PHARMACIST');
                            const { count: prescriptions } = await supabase.from('prescriptions').select('id', { count: 'exact', head: true });
                            const { count: pending } = await supabase.from('prescriptions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING');
                            return {
                                total_pharmacists: pharmacists || 0,
                                total_admins: 0,
                                blocked_users: 0,
                                active_24h: 0,
                                active_7d: 0,
                                total_prescriptions: prescriptions || 0,
                                pending_prescriptions: pending || 0,
                                approved_prescriptions: 0,
                                logins_24h: 0,
                                failed_logins_24h: 0,
                                unresolved_security_events: 0,
                                critical_security_events: 0,
                                total_facilities: 0
                            } as AdminMetricsSummary;
                        }
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
                loading: false,
                error: null
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

    // Setup Polling (every 30 seconds)
    useEffect(() => {
        if (!user) return;
        const intervalId = setInterval(() => {
            fetchData(true);
        }, 30000);

        return () => clearInterval(intervalId);
    }, [user?.id, fetchData]);

    return { ...data, refresh: async () => fetchData(true) };
};

