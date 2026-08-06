'use client';

import { useQuery } from '@tanstack/react-query';

import type { DeliveryDetail } from '@/types/delivery';

export function useDelivery(id: string | null) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: async () => {
      const res = await fetch(`/api/store/deliveries/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch delivery');
      return json.data as DeliveryDetail;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}
