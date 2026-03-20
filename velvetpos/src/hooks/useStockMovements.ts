'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

interface StockMovementFilters {
  productId: string;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export function useStockMovements(filters: StockMovementFilters) {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  const qs = params.toString();

  return useQuery({
    queryKey: ['stock-movements', filters.productId, qs],
    queryFn: async () => {
      const res = await fetch(`/api/store/products/${filters.productId}/movements?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch stock movements');
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
