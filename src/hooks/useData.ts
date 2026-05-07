/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { useAuth } from '../useAuth';

/**
 * Generic hook for fetching data via proxy with React Query caching.
 *
 * KEY FIX: gates ALL queries on sessionReady so they never fire
 * before the Supabase JWT is set. Without this, auth.uid() returns
 * null in RLS policies on page refresh → empty data → zeros/skeletons.
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

  // When sessionReady flips to true, invalidate any cached queries
  // that may have been populated with empty/zero data before the
  // session was confirmed. This forces a fresh fetch.
  React.useEffect(() => {
    if (sessionReady) {
      queryClient.invalidateQueries({
        queryKey: [table, key],
        exact: false,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  return useQuery({
    queryKey: [table, key, JSON.stringify(options)],
    queryFn: async () => {
      const cleanFilters = options.filters
        ? Object.fromEntries(
            Object.entries(options.filters).filter(
              ([, v]) => v !== null && v !== undefined
            )
          )
        : undefined;

      const fetchOptions = {
        select:    options.select,
        filters:   cleanFilters && Object.keys(cleanFilters).length > 0
                     ? cleanFilters
                     : undefined,
        orderBy:   options.orderBy,
        limit:     options.limit,
        single:    options.single,
        countOnly: options.countOnly,
      };

      const res = await fetchWithProxy(table, fetchOptions);

      if (options.countOnly) return res.count ?? 0;
      return (res.data ?? []) as T[];
    },
    // CRITICAL: never fire until session is confirmed
    enabled:              enabled && sessionReady,
    staleTime,
    gcTime:               300000,
    refetchOnWindowFocus: false,
    refetchOnMount:       true,
    retry:                1,
  });
}

// Need React for useEffect
import React from 'react';

/**
 * Hook for mutations (insert/update/delete)
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
        exact:    false,
        type:     'all',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });
}
