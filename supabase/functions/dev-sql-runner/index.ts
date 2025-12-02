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
        const { query } = await req.json()

        // Security: Only allow SELECT queries
        const trimmed = query.trim().toUpperCase()
        if (!trimmed.startsWith('SELECT')) {
            throw new Error('Only SELECT queries are allowed')
        }

        // Verify user is super_admin_dev
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verify user role
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

        if (authError || !user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'super_admin_dev') {
            throw new Error('Insufficient permissions')
        }

        // Execute query
        const { data, error } = await supabaseClient.rpc('execute_sql', { sql_query: query })

        if (error) throw error

        // Log the action
        await supabaseClient.from('audit_logs').insert({
            actor_id: user.id,
            action: 'sql_query_executed',
            payload: { query: query.substring(0, 200) }
        })

        return new Response(
            JSON.stringify({ success: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
