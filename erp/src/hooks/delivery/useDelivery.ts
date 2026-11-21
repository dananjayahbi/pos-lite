'use client';

import { useQuery } from '@tanstack/react-query';

import { DeliveryLoadError } from '@/lib/delivery/loadError';
import type { DeliveryDetail } from '@/types/delivery';

export function useDelivery(id: string | null) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: async () => {
      const res = await fetch(`/api/store/deliveries/${id}`);
      let json: {
        success?: boolean;
        data?: DeliveryDetail;
        error?: { message?: string };
      } | null = null;
      try {
        json = await res.json();
      } catch {
        // A non-JSON error response still needs a status-aware error.
      }
      if (!res.ok || !json?.success || !json.data) {
        throw new DeliveryLoadError(
          json?.error?.message ??
            (res.status === 404 ? 'Delivery not found' : 'Failed to fetch delivery'),
          res.status,
        );
      }
      return json.data;
    },
    enabled: !!id,
    // The detail page owns the retry button; React Query retries would only
    // delay the explicit 404/error state.
    retry: false,
    staleTime: 30_000,
  });
}
