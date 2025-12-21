// Follow this setup guide to integrate the Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import webpush from "https://esm.sh/web-push@3.6.3"
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
        const { title, body, url, userId } = await req.json()

        // 1. Init Supabase (Service Role)
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Fetch Subscriptions for User
        const { data: subscriptions, error } = await supabaseClient
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', userId)

        if (error) throw error
        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 3. Configure Web Push
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
        const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY') || 'BEfJoY88Mtg-3JeQGOVYv0jw5OT5zKgI9GgcvY6U2L7ARjwWbYlEfaZLMMGMYXkdES2QG_E8KSacp8lv1majFSU'
        const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

        if (!vapidPrivateKey) {
            throw new Error('VAPID_PRIVATE_KEY is missing in Secrets')
        }

        webpush.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
        )

        // 4. Send Notifications
        const payload = JSON.stringify({
            title: title || 'PharmAI Alert',
            body: body || 'You have a new update.',
            url: url || '/',
        })

        const results = await Promise.all(
            subscriptions.map(sub =>
                webpush.sendNotification(sub.subscription, payload)
                    .catch(err => {
                        console.error('Push Error:', err)
                        if (err.statusCode === 410) {
                            // Expired subscription, could delete here
                            return { status: 'expired' }
                        }
                        return { status: 'error', error: err }
                    })
            )
        )

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
