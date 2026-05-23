import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Single shared client — explicitly configured so we know exactly
// what storage key prefix Supabase uses (sb-<project-ref>-auth-token).
// autoRefreshToken + persistSession are true by default but stated
// explicitly here so the behaviour is never ambiguous.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'edunexa-auth',   // predictable key we can target in purge
  },
});
