import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[EduNexa] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.'
  );
}

// ── Single client instance, module-level singleton ──────────────────────────
// createClient is safe to call once at module load. All imports share this
// same instance so there is never more than one GoTrue client running.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage so hard-refreshes survive
    persistSession: true,
    // Let Supabase silently refresh the access token before it expires
    autoRefreshToken: true,
    // Pick up the session from the URL hash after OAuth / magic-link redirects
    detectSessionInUrl: true,
    // Use localStorage explicitly (default, but stated for clarity)
    storage: window.localStorage,
    // Storage key prefix — keeps EduNexa tokens isolated from other apps
    storageKey: 'edunexa_supabase_auth',
    // Flow type: 'pkce' is more secure for SPAs
    flowType: 'pkce',
  },
});