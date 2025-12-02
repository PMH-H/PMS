import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { count = 10 } = await req.json()

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Generate sample metric events
        const events = []
        const metricNames = ['sales_total_today', 'users_active', 'prescriptions_pending', 'inventory_low_stock']

        for (let i = 0; i < count; i++) {
            const name = metricNames[Math.floor(Math.random() * metricNames.length)]
            const value = Math.floor(Math.random() * 1000)

            events.push({
                name,
                payload: {
                    value,
                    delta: Math.floor(Math.random() * 20) - 10,
                    timestamp: new Date().toISOString()
                },
                facility_id: null
            })
        }

        const { error } = await supabaseClient
            .from('metric_events')
            .insert(events)

        if (error) throw error

        return new Response(
            JSON.stringify({ success: true, count: events.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
