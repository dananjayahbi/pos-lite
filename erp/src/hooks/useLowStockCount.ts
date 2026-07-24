'use client';

import { useQuery } from '@tanstack/react-query';

export function useLowStockCount() {
  return useQuery<{ success: boolean; data: { count: number } }>({
    queryKey: ['low-stock-count'],
    queryFn: async () => {
      const res = await fetch('/api/store/stock-control/low-stock?countOnly=true');
      if (!res.ok) throw new Error('Failed to fetch low stock count');
      return res.json();
    },
    staleTime: 60_000,
  });
}
