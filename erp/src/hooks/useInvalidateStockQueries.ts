'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { stockAdjustmentQueryKeys } from '@/lib/stock/query-invalidation';

/**
 * ARGUS #194 - invalidate every cache family a stock adjustment changes.
 *
 * Both the single-adjustment form and any bulk-adjust caller use the same list
 * (`src/lib/stock/query-invalidation.ts`), so a new affected screen is added in
 * one place instead of drifting between callers.
 */
export function useInvalidateStockQueries(): () => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all(
      stockAdjustmentQueryKeys().map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  }, [queryClient]);
}
