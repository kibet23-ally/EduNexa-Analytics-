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
 * Coerce filter values to their correct types.
 * After a page refresh, values from localStorage are strings.
 * Supabase bigint columns (school_id, grade_id, etc.) need numbers —
 * otherwise RLS policy comparisons silently return no rows.
 */
function coerceValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Numeric string → number (covers school_id, grade_id, exam_id etc.)
    if (value !== '' && !isNaN(Number(value)) && !value.includes('-') === false) {
      // Keep UUIDs as strings (they contain hyphens)
      return value;
    }
    if (value !== '' && /^\d+$/.test(value)) {
      return Number(value);
    }
  }
  return value;
}

export async function fetchWithProxy(table: string, query: ProxyQuery = {}) {
  try {
    const selectStr = query.select || '*';

    // ── Count-only ──────────────────────────────────────────
    if (query.countOnly) {
      let countQuery = supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          countQuery = countQuery.eq(key, coerceValue(value) as string);
        }
      }

      const { count, error } = await countQuery;
      if (error) throw new Error(error.message);
      return { data: null, count: count ?? 0 };
    }

    // ── Main query ──────────────────────────────────────────
    let dbQuery = supabase.from(table).select(selectStr);

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
      const { data, error } = await (dbQuery as ReturnType<typeof supabase.from>).maybeSingle();
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
    let result;

    if (operation === 'insert') {
      const insertData = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await supabase
        .from(table)
        .insert(insertData)
        .select();
      if (error) throw new Error(error.message);
      result = data;
    }

    else if (operation === 'upsert') {
      const upsertData = Array.isArray(payload) ? payload : [payload];
      const upsertOptions = onConflict ? { onConflict } : {};
      const { data, error } = await supabase
        .from(table)
        .upsert(upsertData, upsertOptions)
        .select();
      if (error) throw new Error(error.message);
      result = data;
    }

    else if (operation === 'update') {
      if (!filters) throw new Error('Update requires filters');
      let updateQuery = supabase
        .from(table)
        .update(payload as Record<string, unknown>);
      for (const [key, value] of Object.entries(filters)) {
        updateQuery = updateQuery.eq(key, coerceValue(value) as string);
      }
      const { data, error } = await updateQuery.select();
      if (error) throw new Error(error.message);
      result = data;
    }

    else if (operation === 'delete') {
      if (!filters) throw new Error('Delete requires filters');
      let deleteQuery = supabase.from(table).delete();
      for (const [key, value] of Object.entries(filters)) {
        deleteQuery = deleteQuery.eq(key, coerceValue(value) as string);
      }
      const { data, error } = await deleteQuery.select();
      if (error) throw new Error(error.message);
      result = data;
    }

    return { data: result };

  } catch (err: unknown) {
    console.error(`writeWithProxy error on table "${table}" (${operation}):`, err);
    throw err;
  }
}
