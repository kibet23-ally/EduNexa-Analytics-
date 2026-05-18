import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { useAuth } from '../useAuth';

/**
 * PRODUCTION FIX:
 * - consistent query keys
 * - stable session gating
 * - correct cache invalidation
 */
export function useData<T>(
  key: string,
  table: string,
  options: {
    select?: string;
    filters?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
    countOnly?: boolean;
  } = {},
  enabled: boolean = true,
  staleTime: number = 60000
) {
  const { sessionReady } = useAuth();
  const queryClient = useQueryClient();

  /**
   * FIX: consistent invalidation
   */
  useEffect(() => {
    if (sessionReady) {
      queryClient.invalidateQueries({
        queryKey: [table],
        exact: false,
      });
    }
  }, [sessionReady, queryClient, table]);

  return useQuery({
    queryKey: [table, key, options], // FIX: no JSON stringify chaos
    queryFn: async () => {
      const cleanFilters = options.filters
        ? Object.fromEntries(
            Object.entries(options.filters).filter(
              ([, v]) => v !== null && v !== undefined
            )
          )
        : undefined;

      const res = await fetchWithProxy(table, {
        select: options.select,
        filters: cleanFilters,
        orderBy: options.orderBy,
        limit: options.limit,
        single: options.single,
        countOnly: options.countOnly,
      });

      if (options.countOnly) return res.count ?? 0;
      return (res.data ?? []) as T[];
    },

    /**
     * CRITICAL FIX:
     * Only block on sessionReady — not external "enabled" flags
     */
    enabled: sessionReady && enabled,

    staleTime,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

/**
 * MUTATIONS (fixed invalidation bug)
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
        queryKey: [table], // FIX: matches queryKey structure
        exact: false,
      });
    },
  });
}