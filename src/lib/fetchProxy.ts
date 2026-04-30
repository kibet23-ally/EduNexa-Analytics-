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

export async function fetchWithProxy(table: string, query: ProxyQuery = {}) {
  try {
    // Build select string
    const selectStr = query.select || '*';

    // Handle count-only requests
    if (query.countOnly) {
      let countQuery = supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      // Apply filters
      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          countQuery = countQuery.eq(key, value as string);
        }
      }

      const { count, error } = await countQuery;
      if (error) throw new Error(error.message);
      return { data: null, count: count ?? 0 };
    }

    // Build main query
    let dbQuery = supabase.from(table).select(selectStr);

    // Apply filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        dbQuery = dbQuery.eq(key, value as string);
      }
    }

    // Apply ordering
    if (query.orderBy) {
      dbQuery = dbQuery.order(query.orderBy.column, {
        ascending: query.orderBy.ascending,
      });
    }

    // Apply limit
    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    // Single record
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
        updateQuery = updateQuery.eq(key, value as string);
      }

      const { data, error } = await updateQuery.select();
      if (error) throw new Error(error.message);
      result = data;
    }

    else if (operation === 'delete') {
      if (!filters) throw new Error('Delete requires filters');
      let deleteQuery = supabase.from(table).delete();

      for (const [key, value] of Object.entries(filters)) {
        deleteQuery = deleteQuery.eq(key, value as string);
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
