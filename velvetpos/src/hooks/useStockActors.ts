'use client';

import { useQuery } from '@tanstack/react-query';

interface StockActor {
  id: string;
  email: string;
}

export function useStockActors() {
  return useQuery<{ success: boolean; data: StockActor[] }>({
    queryKey: ['stock-actors'],
    queryFn: async () => {
      const res = await fetch('/api/store/stock-control/actors');
      if (!res.ok) throw new Error('Failed to fetch actors');
      return res.json() as Promise<{ success: boolean; data: StockActor[] }>;
    },
    staleTime: 60_000,
  });
}
