'use client';

import { useQuery } from '@tanstack/react-query';

interface StockSummary {
  totalProducts: number;
  lowStockVariants: number;
  pendingStockTakes: number;
  totalStockValue: number | null;
}

export function useStockSummary() {
  return useQuery<{ success: boolean; data: StockSummary }>({
    queryKey: ['stock-summary'],
    queryFn: async () => {
      const res = await fetch('/api/store/stock-control/summary');
      if (!res.ok) throw new Error('Failed to fetch stock summary');
      return res.json();
    },
    staleTime: 30_000,
  });
}
