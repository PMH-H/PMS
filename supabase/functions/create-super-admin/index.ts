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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Verify the caller
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !caller) {
            throw new Error('Invalid token');
        }

        // 2. Check caller permissions (must be super_admin_dev)
        const { data: callerProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (profileError || callerProfile?.role !== 'super_admin_dev') {
            return new Response(JSON.stringify({ error: 'Unauthorized: Only Super Admin Dev can create admins.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 3. Parse request body
        const { email, password, fullName, role } = await req.json();

        if (!['super_admin_bms', 'super_admin_dev'].includes(role)) {
            return new Response(JSON.stringify({ error: 'Invalid role. Can only create super_admin_bms or super_admin_dev.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 4. Create the new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        });

        if (createError) throw createError;

        // 5. Update the profile with the correct role
        if (newUser.user) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: newUser.user.id,
                    role: role,
                    full_name: fullName
                })
                .select()
                .single();

            if (updateError) {
                // If upsert fails, try update (in case trigger ran fast)
                const { error: updateError2 } = await supabaseAdmin
                    .from('profiles')
                    .update({ role: role, full_name: fullName })
                    .eq('id', newUser.user.id);

                if (updateError2) throw updateError2;
            }
        }

        return new Response(JSON.stringify({ user: newUser.user, message: 'User created successfully' }), {
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
