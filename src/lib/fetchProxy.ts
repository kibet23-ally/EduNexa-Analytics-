import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const supabaseUrl = 'https://zclwokyzsqzitqwmugtt.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbHdva3l6c3F6aXRxd211Z3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODc2NjIsImV4cCI6MjA5MjI2MzY2Mn0.DZUX4qVSNbd-Ai9R8NmYSQ_mdhhtt2-pYCS_T-D76tk';

interface ProxyQuery {
  select?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  single?: boolean;
  countOnly?: boolean;
}

/**
 * AUTH CLIENT
 */
async function getAuthenticatedClient() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  if (!token) return supabase;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
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
 * FETCH PROXY (FIXED)
 */
export async function fetchWithProxy(
  table: string,
  query: ProxyQuery = {}
) {
  try {
    const db = await getAuthenticatedClient();

    /**
     * =========================
     * COUNT ONLY (FIXED)
     * =========================
     */
    if (query.countOnly) {
      let q = db
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          q = q.eq(key, value as any);
        }
      }

      const { count, error } = await q;

      if (error) throw error;

      return {
        data: null,
        count: count ?? 0,
      };
    }

    /**
     * =========================
     * NORMAL QUERY
     * =========================
     */
    const selectStr = query.select || '*';

    let q = db.from(table).select(selectStr);

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        q = q.eq(key, value as any);
      }
    }

    if (query.orderBy) {
      q = q.order(query.orderBy.column, {
        ascending: query.orderBy.ascending,
      });
    }

    if (query.limit) {
      q = q.limit(query.limit);
    }

    if (query.single) {
      const { data, error } = await q.maybeSingle();

      if (error) throw error;

      return {
        data,
        count: data ? 1 : 0,
      };
    }

    const { data, error } = await q;

    if (error) throw error;

    return {
      data: data ?? [],
      count: data?.length ?? 0,
    };
  } catch (err) {
    console.error(`fetchWithProxy error (${table}):`, err);
    throw err;
  }
}

/**
 * WRITE PROXY (FIXED + RESTORED EXPORT)
 */
export async function writeWithProxy(
  table: string,
  operation: 'insert' | 'update' | 'delete' | 'upsert',
  payload?: unknown,
  filters?: Record<string, unknown>,
  onConflict?: string
) {
  try {
    const db = await getAuthenticatedClient();

    /**
     * INSERT
     */
    if (operation === 'insert') {
      const { data, error } = await db
        .from(table)
        .insert(payload as any)
        .select();

      if (error) throw error;

      return { data };
    }

    /**
     * UPDATE
     */
    if (operation === 'update') {
      let q = db.from(table).update(payload as any);

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          q = q.eq(key, value as any);
        }
      }

      const { data, error } = await q.select();

      if (error) throw error;

      return { data };
    }

    /**
     * DELETE
     */
    if (operation === 'delete') {
      let q = db.from(table).delete();

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          q = q.eq(key, value as any);
        }
      }

      const { data, error } = await q.select();

      if (error) throw error;

      return { data };
    }

    /**
     * UPSERT
     */
    if (operation === 'upsert') {
      const { data, error } = await db
        .from(table)
        .upsert(payload as any, {
          onConflict,
        })
        .select();

      if (error) throw error;

      return { data };
    }

    throw new Error(`Unsupported operation: ${operation}`);
  } catch (err) {
    console.error(`writeWithProxy error (${table}):`, err);
    throw err;
  }
}