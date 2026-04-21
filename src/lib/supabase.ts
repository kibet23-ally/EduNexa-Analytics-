import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Clean up URL if it has /rest/v1/ suffix
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

if (!import.meta.env.VITE_SUPABASE_URL || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder');
