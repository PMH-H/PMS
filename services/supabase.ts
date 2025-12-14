import { createClient } from '@supabase/supabase-js';

// Vite exposes env vars prefixed with VITE_
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local");
    console.warn("Running in OFFLINE MODE - using mock data only");
}

// Create Supabase client
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
);

// Helper to check connection
export const checkSupabaseConnection = async () => {
    try {
        if (!supabaseUrl || !supabaseAnonKey) return false;

        // Attempt a lightweight query to verify connectivity
        const { error } = await supabase.from('items').select('count', { count: 'exact', head: true });

        if (error) {
            console.warn("Supabase connection check error:", error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.warn("Supabase connection check failed (Offline Mode Active).", e);
        return false;
    }
};

// Auth helpers
export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    // Log auth event (non-blocking)
    try {
        const { logAuthEvent } = await import('./metricsService');
        if (error) {
            logAuthEvent(null, 'login_failed', false, { email }, error.message);
        } else if (data.user) {
            logAuthEvent(data.user.id, 'login_success', true, { email });
        }
    } catch (e) {
        console.warn('Failed to log auth event:', e);
    }

    return { data, error };
};

export const signUp = async (email: string, password: string, metadata?: any) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata
        }
    });
    return { data, error };
};

export const signOut = async () => {
    // Get current user before signing out to log the event
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    // Log logout event (non-blocking)
    try {
        const { logAuthEvent } = await import('./metricsService');
        if (!error && user) {
            logAuthEvent(user.id, 'logout', true);
        }
    } catch (e) {
        console.warn('Failed to log auth event:', e);
    }

    return { error };
};

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const getCurrentSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
};