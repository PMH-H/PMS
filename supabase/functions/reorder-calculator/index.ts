// =====================================================
// REORDER CALCULATOR EDGE FUNCTION
// =====================================================
// Calculates optimal reorder points and quantities
// using multiple inventory formulas
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ReorderRequest {
  item_id: string;
  facility_id: string;
  formula_type?: 'MIN_MAX' | 'LEAD_TIME' | 'CONSUMPTION' | 'EOQ' | 'EMERGENCY';
}

interface ReorderResponse {
  reorder_point: number;
  order_quantity: number;
  stockout_date: string | null;
  confidence: number;
  formula_used: string;
  details: {
    current_stock: number;
    average_daily_consumption: number;
    lead_time_days: number;
    safety_stock: number;
  };
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { item_id, facility_id, formula_type = 'MIN_MAX' }: ReorderRequest = await req.json();

    // Get item details
    const { data: item, error: itemError } = await supabaseClient
      .from('items')
      .select('*, min_level, max_level, safety_stock, lead_time_days')
      .eq('id', item_id)
      .single();

    if (itemError) throw itemError;

    // Get current stock for facility
    const { data: batches } = await supabaseClient
      .from('item_batches')
      .select('current_quantity')
      .eq('item_id', item_id)
      .eq('facility_id', facility_id);

    const current_stock = batches?.reduce((sum, b) => sum + b.current_quantity, 0) || 0;

    // Get consumption data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: movements } = await supabaseClient
      .from('stock_movements')
      .select('quantity, created_at')
      .eq('item_id', item_id)
      .eq('facility_id', facility_id)
      .eq('movement_type', 'OUT')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const total_consumed = movements?.reduce((sum, m) => sum + Math.abs(m.quantity), 0) || 0;
    const average_daily_consumption = total_consumed / 30;

    let reorder_point = 0;
    let order_quantity = 0;
    let confidence = 0.8;

    // Calculate based on formula type
    switch (formula_type) {
      case 'MIN_MAX':
        reorder_point = item.min_level;
        order_quantity = item.max_level - current_stock;
        confidence = 0.9;
        break;

      case 'LEAD_TIME':
        reorder_point = (average_daily_consumption * item.lead_time_days) + item.safety_stock;
        order_quantity = (average_daily_consumption * item.lead_time_days * 2);
        confidence = 0.85;
        break;

      case 'CONSUMPTION':
        const review_period = 7; // days
        reorder_point = (average_daily_consumption * (item.lead_time_days + review_period)) + item.safety_stock;
        order_quantity = (average_daily_consumption * 30); // 30 days supply
        confidence = 0.8;
        break;

      case 'EOQ':
        const annual_demand = average_daily_consumption * 365;
        const ordering_cost = 100; // Mock value
        const holding_cost_per_unit = 0.5; // Mock value
        const eoq = Math.sqrt((2 * annual_demand * ordering_cost) / holding_cost_per_unit);
        reorder_point = (average_daily_consumption * item.lead_time_days) + item.safety_stock;
        order_quantity = Math.round(eoq);
        confidence = 0.75;
        break;

      case 'EMERGENCY':
        reorder_point = item.safety_stock;
        order_quantity = item.max_level;
        confidence = 1.0;
        break;
    }

    // Calculate stockout date
    let stockout_date = null;
    if (average_daily_consumption > 0) {
      const days_until_stockout = current_stock / average_daily_consumption;
      const stockout = new Date();
      stockout.setDate(stockout.getDate() + Math.floor(days_until_stockout));
      stockout_date = stockout.toISOString().split('T')[0];
    }

    const response: ReorderResponse = {
      reorder_point: Math.round(reorder_point),
      order_quantity: Math.round(order_quantity),
      stockout_date,
      confidence,
      formula_used: formula_type,
      details: {
        current_stock,
        average_daily_consumption: Math.round(average_daily_consumption * 100) / 100,
        lead_time_days: item.lead_time_days,
        safety_stock: item.safety_stock
      }
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
