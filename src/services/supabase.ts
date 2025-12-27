import { supabaseCore } from './supabaseCore';

// Re-export the core client as the default 'supabase' export for backward compatibility
// This ensures existing code works but uses the lighter client
export const supabase = supabaseCore;

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