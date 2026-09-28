'use client';

import { useQuery } from '@tanstack/react-query';

interface StockMovementItem {
  id: string;
  createdAt: string;
  reason: string;
  quantityDelta: number;
  variant: { sku: string };
  /**
   * Nullable in the database: automated movements (storefront checkout
   * reservations, courier syncs) have no acting user. Consumers must go
   * through `stockActorLabel()` rather than reading `.email` directly —
   * assuming non-null here is what crashed the dashboard card.
   */
  actor: { email: string } | null;
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
