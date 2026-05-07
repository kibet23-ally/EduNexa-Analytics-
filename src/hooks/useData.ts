/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { useAuth } from '../useAuth';

/**
 * Generic hook for fetching data via proxy with React Query caching.
 *
 * KEY FIX: gates on sessionReady from AuthContext so queries never
 * fire before the Supabase JWT is set. Without this, auth.uid()
 * returns null in RLS policies on page refresh → empty data → skeletons.
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
        select:     options.select,
        filters:    cleanFilters && Object.keys(cleanFilters).length > 0
                      ? cleanFilters
                      : undefined,
        orderBy:    options.orderBy,
        limit:      options.limit,
        single:     options.single,
        countOnly:  options.countOnly,
      };

      const res = await fetchWithProxy(table, fetchOptions);

      if (options.countOnly) return res.count ?? 0;
      return (res.data ?? []) as T[];
    },
    // Only fire when BOTH the caller says enabled AND session is confirmed
    enabled: enabled && sessionReady,
    staleTime,
    gcTime:             300000,
    refetchOnWindowFocus: false,
    refetchOnMount:       true,   // refetch on mount now that session is ready
    retry:              1,
  });
}

/**
 * Hook for mutations (insert/update/delete) with optimistic updates support
 */
export function useDataMutation(table: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      operation,
      payload,
      filters,
    }: {
      operation: 'insert' | 'update' | 'delete' | 'upsert';
      payload?: any;
      filters?: any;
    }) => {
      return await writeWithProxy(table, operation, payload, filters);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey:  [table],
        exact:     false,
        type:      'all',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });
}
