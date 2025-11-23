// =====================================================
// STOCK HEALTH ANALYZER EDGE FUNCTION
// =====================================================
// Analyzes overall inventory health with ABC/VEN
// classification, turnover, shrinkage, and service level
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface HealthRequest {
    facility_id: string;
    date_range?: {
        start: string;
        end: string;
    };
}

interface HealthResponse {
    health_score: number; // 0-100
    insights: string[];
    recommendations: string[];
    metrics: {
        total_items: number;
        stockout_items: number;
        near_expiry_items: number;
        overstock_items: number;
        average_turnover_rate: number;
        total_shrinkage_value: number;
        service_level: number;
    };
    abc_distribution: {
        A: number;
        B: number;
        C: number;
    };
    ven_distribution: {
        V: number;
        E: number;
        N: number;
    };
    aging_stock: Array<{
        item_name: string;
        batch_no: string;
        days_until_expiry: number;
        quantity: number;
    }>;
}

serve(async (req) => {
    try {
        if (req.method === 'OPTIONS') {
            return new Response('ok', { headers: corsHeaders });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { facility_id, date_range }: HealthRequest = await req.json();

        const endDate = date_range?.end || new Date().toISOString();
        const startDate = date_range?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Get all items for facility
        const { data: batches } = await supabaseClient
            .from('item_batches')
            .select('*, items(*)')
            .eq('facility_id', facility_id);

        if (!batches || batches.length === 0) {
            throw new Error('No inventory data found for this facility');
        }

        // Calculate metrics
        const itemMap = new Map();
        batches.forEach(batch => {
            const itemId = batch.item_id;
            if (!itemMap.has(itemId)) {
                itemMap.set(itemId, {
                    item: batch.items,
                    total_stock: 0,
                    batches: []
                });
            }
            const item = itemMap.get(itemId);
            item.total_stock += batch.current_quantity;
            item.batches.push(batch);
        });

        const total_items = itemMap.size;
        let stockout_items = 0;
        let overstock_items = 0;
        let near_expiry_items = 0;

        const abc_distribution = { A: 0, B: 0, C: 0 };
        const ven_distribution = { V: 0, E: 0, N: 0 };
        const aging_stock: any[] = [];

        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        itemMap.forEach((data, itemId) => {
            const { item, total_stock, batches: itemBatches } = data;

            // Stockout check
            if (total_stock === 0) stockout_items++;

            // Overstock check
            if (total_stock > item.max_level) overstock_items++;

            // ABC/VEN distribution
            abc_distribution[item.category]++;
            ven_distribution[item.ven_class]++;

            // Near expiry check
            itemBatches.forEach((batch: any) => {
                const expiryDate = new Date(batch.expiry_date);
                const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (daysUntilExpiry <= 30 && daysUntilExpiry > 0 && batch.current_quantity > 0) {
                    near_expiry_items++;
                    aging_stock.push({
                        item_name: item.name,
                        batch_no: batch.batch_no,
                        days_until_expiry: daysUntilExpiry,
                        quantity: batch.current_quantity
                    });
                }
            });
        });

        // Get stock movements for turnover calculation
        const { data: movements } = await supabaseClient
            .from('stock_movements')
            .select('item_id, quantity')
            .eq('facility_id', facility_id)
            .eq('movement_type', 'OUT')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        const totalSold = movements?.reduce((sum, m) => sum + Math.abs(m.quantity), 0) || 0;
        const totalStock = Array.from(itemMap.values()).reduce((sum, data) => sum + data.total_stock, 0);
        const average_turnover_rate = totalStock > 0 ? (totalSold / totalStock) : 0;

        // Service level (mock calculation - % of time stock was available)
        const service_level = ((total_items - stockout_items) / total_items) * 100;

        // Calculate health score
        let health_score = 100;
        health_score -= (stockout_items / total_items) * 30; // -30 points max for stockouts
        health_score -= (overstock_items / total_items) * 20; // -20 points max for overstock
        health_score -= (near_expiry_items / total_items) * 15; // -15 points for near expiry
        health_score = Math.max(0, Math.min(100, health_score));

        // Generate insights
        const insights: string[] = [];
        const recommendations: string[] = [];

        if (stockout_items > 0) {
            insights.push(`${stockout_items} items are currently out of stock`);
            recommendations.push('Review reorder points for stockout items');
        }

        if (overstock_items > 0) {
            insights.push(`${overstock_items} items are overstocked`);
            recommendations.push('Consider reducing order quantities for overstocked items');
        }

        if (near_expiry_items > 0) {
            insights.push(`${near_expiry_items} batches expiring within 30 days`);
            recommendations.push('Implement FEFO (First Expired, First Out) dispensing');
        }

        if (average_turnover_rate < 0.5) {
            insights.push('Low inventory turnover detected');
            recommendations.push('Review slow-moving items and adjust stock levels');
        }

        if (service_level < 95) {
            insights.push(`Service level at ${service_level.toFixed(1)}% (target: 95%+)`);
            recommendations.push('Increase safety stock for critical items');
        }

        // Sort aging stock by days until expiry
        aging_stock.sort((a, b) => a.days_until_expiry - b.days_until_expiry);

        const response: HealthResponse = {
            health_score: Math.round(health_score),
            insights,
            recommendations,
            metrics: {
                total_items,
                stockout_items,
                near_expiry_items,
                overstock_items,
                average_turnover_rate: Math.round(average_turnover_rate * 100) / 100,
                total_shrinkage_value: 0, // TODO: Calculate from adjustments
                service_level: Math.round(service_level * 10) / 10
            },
            abc_distribution,
            ven_distribution,
            aging_stock: aging_stock.slice(0, 10) // Top 10 most urgent
        };

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
