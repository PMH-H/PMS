import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing in environment variables.");
}

// To prevent "supabaseUrl is required" crash if env vars are missing, we use a placeholder or empty string,
// but functionality will fail if keys are invalid.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

// Helper to check connection
export const checkSupabaseConnection = async () => {
    try {
        if (!supabaseUrl || !supabaseAnonKey) return false;
        
        // Attempt a lightweight query to verify connectivity
        const { error } = await supabase.from('drugs').select('count', { count: 'exact', head: true });
        
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