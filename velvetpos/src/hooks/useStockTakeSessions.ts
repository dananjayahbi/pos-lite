'use client';

import { useQuery } from '@tanstack/react-query';

export interface StockTakeSessionSummary {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  status: string;
  initiatedBy: string;
  startedAt: string;
  completedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  itemCount: number;
  discrepancyCount: number;
}

export function useStockTakeSessions() {
  return useQuery<{ success: boolean; data: StockTakeSessionSummary[] }>({
    queryKey: ['stock-take-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/store/stock-control/stock-takes');
      if (!res.ok) throw new Error('Failed to fetch stock take sessions');
      return res.json();
    },
    staleTime: 30_000,
  });
}
