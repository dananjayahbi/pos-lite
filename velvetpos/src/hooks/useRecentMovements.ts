'use client';

import { useQuery } from '@tanstack/react-query';

interface StockMovementItem {
  id: string;
  createdAt: string;
  reason: string;
  quantityDelta: number;
  variant: { sku: string };
  actor: { email: string };
}

export function useRecentMovements() {
  return useQuery<{ success: boolean; data: StockMovementItem[] }>({
    queryKey: ['recent-movements'],
    queryFn: async () => {
      const res = await fetch('/api/store/stock-control/recent-movements');
      if (!res.ok) throw new Error('Failed to fetch recent movements');
      return res.json();
    },
    staleTime: 30_000,
  });
}
