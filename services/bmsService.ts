/**
 * BMS (Business Management System) Data Service
 * 
 * Provides aggregated data across all facilities for business intelligence,
 * analytics, and data brokerage purposes.
 * 
 * Best Practices:
 * - Separation of concerns: Business logic isolated from UI
 * - Type safety: All return types explicitly defined
 * - Error handling: Graceful degradation with fallback data
 * - Performance: Efficient queries with proper indexing assumptions
 */

import { supabase } from './supabase';

export interface FacilityMetrics {
    id: string;
    name: string;
    type: string;
    region: string;
    isActive: boolean;
    totalSales: number;
    totalRevenue: number;
    inventoryValue: number;
    lowStockCount: number;
    expiringItemsCount: number;
    complianceScore: number;
    lastAuditDate: string | null;
}

export interface RegionalAggregate {
    region: string;
    facilityCount: number;
    totalRevenue: number;
    totalSales: number;
    avgComplianceScore: number;
}

export interface CategoryTrend {
    category: string;
    month: string;
    totalSold: number;
    avgPrice: number;
    facilityCount: number;
}

/**
 * Fetches all facilities with their basic metrics
 * Used by BMS Dashboard for governance and oversight
 */
export async function getAllFacilities(): Promise<FacilityMetrics[]> {
    try {
        const { data: facilities, error } = await supabase
            .from('facilities')
            .select('id, name, type, address, is_active, created_at')
            .eq('type', 'PHARMACY') // Only pharmacies, not districts/regions
            .order('name');

        if (error) throw error;
        if (!facilities) return [];

        // For each facility, calculate metrics
        const metricsPromises = facilities.map(async (facility) => {
            // Get sales data
            const { data: sales } = await supabase
                .from('sales')
                .select('total_price, created_at')
                .eq('facility_id', facility.id);

            const totalRevenue = sales?.reduce((sum, s) => sum + s.total_price, 0) || 0;
            const totalSales = sales?.length || 0;

            // Get inventory batches
            const { data: batches } = await supabase
                .from('item_batches')
                .select('current_quantity, cost_per_unit, expiry_date')
                .eq('facility_id', facility.id);

            const inventoryValue = batches?.reduce((sum, b) =>
                sum + (b.current_quantity * b.cost_per_unit), 0) || 0;

            // Count expiring items (within 90 days)
            const ninetyDaysFromNow = new Date();
            ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
            const expiringItemsCount = batches?.filter(b =>
                new Date(b.expiry_date) <= ninetyDaysFromNow && b.current_quantity > 0
            ).length || 0;

            // Get low stock count (simplified - would need item min_level join)
            const lowStockCount = 0; // TODO: Implement with item join

            // Extract region from address (simplified)
            const region = facility.address?.split(',').pop()?.trim() || 'Unknown';

            // Calculate compliance score (placeholder - would need audit data)
            const complianceScore = facility.is_active ? 95 : 60;

            return {
                id: facility.id,
                name: facility.name,
                type: facility.type,
                region,
                isActive: facility.is_active,
                totalSales,
                totalRevenue,
                inventoryValue,
                lowStockCount,
                expiringItemsCount,
                complianceScore,
                lastAuditDate: null // TODO: Add audit_logs table query
            };
        });

        return await Promise.all(metricsPromises);

    } catch (error) {
        console.error('Error fetching facility metrics:', error);
        return [];
    }
}

/**
 * Aggregates data by region for regional analysis
 */
export async function getRegionalAggregates(): Promise<RegionalAggregate[]> {
    try {
        const facilities = await getAllFacilities();

        // Group by region
        const regionMap = new Map<string, FacilityMetrics[]>();
        facilities.forEach(f => {
            const existing = regionMap.get(f.region) || [];
            regionMap.set(f.region, [...existing, f]);
        });

        // Calculate aggregates
        const aggregates: RegionalAggregate[] = [];
        regionMap.forEach((facilities, region) => {
            aggregates.push({
                region,
                facilityCount: facilities.length,
                totalRevenue: facilities.reduce((sum, f) => sum + f.totalRevenue, 0),
                totalSales: facilities.reduce((sum, f) => sum + f.totalSales, 0),
                avgComplianceScore: facilities.reduce((sum, f) => sum + f.complianceScore, 0) / facilities.length
            });
        });

        return aggregates.sort((a, b) => b.totalRevenue - a.totalRevenue);

    } catch (error) {
        console.error('Error calculating regional aggregates:', error);
        return [];
    }
}

/**
 * Gets sales trends by category across all facilities
 * Used for market analysis and demand forecasting
 */
export async function getCategoryTrends(months: number = 6): Promise<CategoryTrend[]> {
    try {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        // Get all sales with items
        const { data: sales, error } = await supabase
            .from('sales')
            .select('items, created_at, facility_id')
            .gte('created_at', startDate.toISOString());

        if (error) throw error;
        if (!sales) return [];

        // Get item details for category mapping
        const { data: items } = await supabase
            .from('items')
            .select('id, category');

        const itemCategoryMap = new Map(items?.map(i => [i.id, i.category]) || []);

        // Aggregate by category and month
        const trendMap = new Map<string, CategoryTrend>();

        sales.forEach(sale => {
            const month = new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            sale.items.forEach((item: any) => {
                const category = itemCategoryMap.get(item.item_id) || 'Unknown';
                const key = `${category}-${month}`;

                const existing = trendMap.get(key) || {
                    category,
                    month,
                    totalSold: 0,
                    avgPrice: 0,
                    facilityCount: 0
                };

                existing.totalSold += item.quantity;
                existing.avgPrice = ((existing.avgPrice * existing.facilityCount) + item.unit_price) / (existing.facilityCount + 1);
                existing.facilityCount += 1;

                trendMap.set(key, existing);
            });
        });

        return Array.from(trendMap.values());

    } catch (error) {
        console.error('Error fetching category trends:', error);
        return [];
    }
}

/**
 * Updates facility data sharing preference
 * Used for governance and data brokerage consent management
 */
export async function updateFacilityDataSharing(
    facilityId: string,
    enabled: boolean
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('facilities')
            .update({ data_sharing_enabled: enabled })
            .eq('id', facilityId);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error('Error updating data sharing:', error);
        return false;
    }
}
