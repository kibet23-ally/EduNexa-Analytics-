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

/**
 * 🔥 FIXED CORE IDEA:
 * NEVER return {count, data} to UI
 * UI must ALWAYS receive:
 *   - number (countOnly)
 *   - array (normal query)
 */
export function useData<T>(
  key: string,
  table: string,
  options: QueryOptions = {},
  enabled: boolean = true,
  staleTime: number = 60000
) {
  const { sessionReady } = useAuth();
  const queryClient = useQueryClient();

  // 🔥 FIX: invalidate AFTER session ready
  React.useEffect(() => {
    if (sessionReady) {
      queryClient.invalidateQueries({ queryKey: [table] });
    }
  }, [sessionReady, table, queryClient]);

  return useQuery({
    queryKey: [table, key, options],
    enabled: enabled && sessionReady,

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

      // =========================
      // 🔥 FIX CRITICAL PART HERE
      // =========================

      if (options.countOnly) {
        // ALWAYS return number
        return Number(res.count ?? 0);
      }

      // ALWAYS return array (never object)
      return Array.isArray(res.data) ? res.data : [];
    },

    staleTime,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

/**
 * MUTATION HOOK (unchanged but safe)
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
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });
}