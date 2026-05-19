/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { useAuth } from '../useAuth';

type QueryOptions = {
  select?: string;
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
  countOnly?: boolean;
};

export function useData<T>(
  key: string,
  table: string,
  options: QueryOptions = {},
  enabled: boolean = true,
  staleTime: number = 60000
) {
  const { sessionReady, user } = useAuth();
  const queryClient = useQueryClient();

  const isSuperAdmin =
    user?.role === 'super_admin' || user?.role === 'superadmin';

  /**
   * ✅ FIX: Only scope by school IF NOT super admin
   */
  const scopedFilters = React.useMemo(() => {
    if (isSuperAdmin) {
      return options.filters || {};
    }

    if (!user?.school_id) {
      return options.filters || {};
    }

    return {
      school_id: user.school_id,
      ...options.filters,
    };
  }, [isSuperAdmin, user?.school_id, options.filters]);

  /**
   * ✅ FIX: Proper invalidation
   */
  React.useEffect(() => {
    if (sessionReady && user) {
      queryClient.invalidateQueries({
        queryKey: [table],
        exact: false,
      });
    }
  }, [sessionReady, user, table, queryClient]);

  /**
   * ✅ FIX: Allow super admin even without school_id
   */
  const queryEnabled =
    enabled &&
    sessionReady &&
    !!user &&
    (isSuperAdmin || !!user?.school_id);

  return useQuery({
    queryKey: [table, key, scopedFilters],

    enabled: queryEnabled,

    queryFn: async () => {
      const res = await fetchWithProxy(table, {
        select: options.select,
        filters: scopedFilters,
        orderBy: options.orderBy,
        limit: options.limit,
        single: options.single,
        countOnly: options.countOnly,
      });

      if (options.countOnly) {
        return Number(res.count ?? 0);
      }

      return Array.isArray(res.data) ? res.data : [];
    },

    staleTime,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * ✅ SAFE MUTATION HOOK
 */
export function useDataMutation(table: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      operation,
      payload,
      filters,
      onConflict,
    }: {
      operation: 'insert' | 'update' | 'delete' | 'upsert';
      payload?: any;
      filters?: any;
      onConflict?: string;
    }) => {
      return await writeWithProxy(table, operation, payload, filters, onConflict);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [table],
        exact: false,
      });
    },
  });
}