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
    storageKey: 'edunexa-auth',
    // Prevent "Lock broken by another request with the 'steal' option" error.
    // This happens when multiple tabs compete for the same IndexedDB lock.
    // We use a timeout-based lock that yields gracefully instead of stealing.
    lock: (name: string, acquireTimeout: number, fn: <T>() => Promise<T>): Promise<T> => {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request(
          name,
          { timeout: acquireTimeout },
          fn
        ) as Promise<T>;
      }
      // Fallback: no lock support — just run the function directly
      return fn();
    },
  },
});