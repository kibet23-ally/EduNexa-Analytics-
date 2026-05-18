export async function fetchWithProxy(
  table: string,
  query: ProxyQuery = {}
) {
  try {
    const db = await getAuthenticatedClient();

    /**
     * =========================
     * COUNT ONLY
     * =========================
     */
    if (query.countOnly) {
      let countQuery = db
        .from(table)
        .select('*', {
          count: 'exact',
          head: true,
        });

      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          countQuery = countQuery.eq(key, value as any);
        }
      }

      const { count, error } = await countQuery;

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

    // filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        q = q.eq(key, value as any);
      }
    }

    // order
    if (query.orderBy) {
      q = q.order(query.orderBy.column, {
        ascending: query.orderBy.ascending,
      });
    }

    // limit
    if (query.limit) {
      q = q.limit(query.limit);
    }

    // single
    if (query.single) {
      const { data, error } = await q.maybeSingle();

      if (error) throw error;

      return {
        data,
        count: data ? 1 : 0,
      };
    }

    // normal fetch
    const { data, error } = await q;

    if (error) throw error;

    return {
      data: data || [],
      count: data?.length || 0,
    };

  } catch (err) {
    console.error(`fetchWithProxy error (${table}):`, err);
    throw err;
  }
}