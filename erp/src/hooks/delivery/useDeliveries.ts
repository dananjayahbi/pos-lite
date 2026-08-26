'use client';

import { useQuery } from '@tanstack/react-query';

import type { DeliveryStatus, DeliverySource } from '@/generated/prisma/client';
import type { DeliveryListItem } from '@/types/delivery';

export interface DeliveryFilters {
  status?: DeliveryStatus | null | undefined;
  source?: DeliverySource | null | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export function useDeliveries(filters: DeliveryFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });

  return useQuery({
    queryKey: ['deliveries', filters],
    queryFn: async () => {
      const res = await fetch(`/api/store/deliveries?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch deliveries');
      return json.data as {
        items: DeliveryListItem[];
        total: number;
        page: number;
        limit: number;
      };
    },
    staleTime: 30_000,
  });
}
