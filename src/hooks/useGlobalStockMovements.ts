'use client';

import { useQuery } from '@tanstack/react-query';

interface GlobalMovementFilters {
  page?: number | undefined;
  limit?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
  reasons?: string | undefined;
  search?: string | undefined;
  actorId?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

interface MovementItem {
  id: string;
  createdAt: string;
  reason: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  note: string | null;
  variant: {
    sku: string;
    size: string | null;
    colour: string | null;
    lowStockThreshold: number;
    product: { id: string; name: string; category: { name: string } };
  };
  actor: { id: string; email: string };
}

interface MovementsResponse {
  success: boolean;
  data: MovementItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type { GlobalMovementFilters, MovementItem };

export function useGlobalStockMovements(filters: GlobalMovementFilters) {
  return useQuery<MovementsResponse>({
    queryKey: ['global-stock-movements', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== '') params.set(k, String(v));
      }
      const res = await fetch(`/api/store/stock-control/movements?${params}`);
      if (!res.ok) throw new Error('Failed to fetch stock movements');
      return res.json() as Promise<MovementsResponse>;
    },
    staleTime: 30_000,
  });
}
