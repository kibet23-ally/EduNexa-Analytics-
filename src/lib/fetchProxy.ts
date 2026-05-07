import { createClient } from '@supabase/supabase-js';

// Create a dedicated client for data queries that always has the
// correct session token set before firing any request.
// This solves the refresh bug where auth.uid() returns null
// because the shared client hasn't restored the session yet.
const supabaseUrl     = 'https://zclwokyzsqzitqwmugtt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbHdva3l6c3F6aXRxd211Z3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODc2NjIsImV4cCI6MjA5MjI2MzY2Mn0.DZUX4qVSNbd-Ai9R8NmYSQ_mdhhtt2-pYCS_T-D76tk';

// Import the shared supabase client for auth session access
import { supabase } from './supabase';

interface ProxyQuery {
  select?: string;
  options?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  single?: boolean;
  countOnly?: boolean;
}

/**
 * Get a Supabase client that has the current user's JWT set.
 * This ensures auth.uid() is always populated in RLS policies,
 * even immediately after a page refresh.
 */
async function getAuthenticatedClient() {
  // Try to get the current session token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    // Fall back to anon client — RLS will return empty for protected tables
    return supabase;
  }

  // Create a fresh client with the user's JWT injected as the auth header.
  // This guarantees auth.uid() returns the correct UUID in all RLS policies.
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Coerce filter values to their correct types.
 * After a page refresh, values from localStorage are strings.
 * Supabase bigint columns need numbers for correct comparisons.
 */
function coerceValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

export async function fetchWithProxy(table: string, query: ProxyQuery = {}) {
  try {
    // Always get authenticated client before querying
    const db = await getAuthenticatedClient();
    const selectStr = query.select || '*';

    // ── Count-only ──────────────────────────────────────────
    if (query.countOnly) {
      let q = db.from(table).select('*', { count: 'exact', head: true });
      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          q = q.eq(key, coerceValue(value) as string);
        }
      }
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return { data: null, count: count ?? 0 };
    }

    // ── Main query ──────────────────────────────────────────
    let dbQuery = db.from(table).select(selectStr);

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        dbQuery = dbQuery.eq(key, coerceValue(value) as string);
      }
    }

    if (query.orderBy) {
      dbQuery = dbQuery.order(query.orderBy.column, {
        ascending: query.orderBy.ascending,
      });
    }

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    if (query.single) {
      const { data, error } = await dbQuery.maybeSingle();
      if (error) throw new Error(error.message);
      return { data, count: data ? 1 : 0 };
    }

    const { data, error, count } = await dbQuery;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? (data?.length ?? 0) };

  } catch (err: unknown) {
    console.error(`fetchWithProxy error on table "${table}":`, err);
    throw err;
  }
}

export async function writeWithProxy(
  table: string,
  operation: 'insert' | 'update' | 'delete' | 'upsert',
  payload?: unknown,
  filters?: Record<string, unknown>,
  onConflict?: string
) {
  try {
    // Always get authenticated client for writes too
    const db = await getAuthenticatedClient();
    let result;

    if (operation === 'insert') {
      const insertData = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await db.from(table).insert(insertData).select();
      if (error) throw new Error(error.message);
      result = data;
    }

    else if (operation === 'upsert') {
      const upsertData = Array.isArray(payload) ? payload : [payload];
      // Always specify onConflict for upsert — without it Postgres
      // falls back to the primary key and hits unique constraints
      const upsertOptions: Record<string, unknown> = {};
      if (onConflict) {
        upsertOptions.onConflict = onConflict;
      }
      const { data, error } = await db
        .from(table)
        .upsert(upsertData, upsertOptions)
        .select();
      if (error) throw new Error(error.message);
      result = data;
    }

    else if (operation === 'update') {
      if (!filters) throw new Error('Update requires filters');
      let q = db.from(table).update(payload as Record<string, unknown>);
      for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, coerceValue(value) as string);
      }
      const { data, error } = await q.select();
      if (error) throw new Error(error.message);
      result = data;
    }

    else if (operation === 'delete') {
      if (!filters) throw new Error('Delete requires filters');
      let q = db.from(table).delete();
      for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, coerceValue(value) as string);
      }
      const { data, error } = await q.select();
      if (error) throw new Error(error.message);
      result = data;
    }

    return { data: result };

  } catch (err: unknown) {
    console.error(`writeWithProxy error on table "${table}" (${operation}):`, err);
    throw err;
  }
}
