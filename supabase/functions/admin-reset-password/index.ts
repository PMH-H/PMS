
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Initialize Admin Client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Verify Caller
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !caller) {
            throw new Error('Invalid token');
        }

        // 3. Verify Authorization (Super Admin Only)
        const { data: callerProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (profileError || !['super_admin_bms', 'super_admin_dev'].includes(callerProfile?.role)) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Insufficient privileges.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 4. Parse Body
        const { userId, newPassword } = await req.json();
        if (!userId || !newPassword) {
            return new Response(JSON.stringify({ error: 'Missing userId or newPassword.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        if (newPassword.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 5. Update Password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword,
        });

        if (updateError) throw updateError;

        // 6. Create Audit Log
        // We try to insert into audit_log table. If it fails, we log to console but don't fail the request.
        try {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'ADMIN_PASSWORD_RESET',
                entity_type: 'user',
                entity_id: userId,
                performed_by: caller.id,
                details: { reason: 'Admin forced reset' }
            });
        } catch (auditErr) {
            console.error("Failed to write audit log:", auditErr);
        }

        return new Response(JSON.stringify({ message: 'Password reset successfully.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
