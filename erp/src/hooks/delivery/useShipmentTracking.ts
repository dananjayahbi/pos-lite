'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { CourierTracking } from '@/lib/courier/types';

/**
 * Shipment tracking for one shipment (ARGUS #270).
 *
 * A successful Track call updates the carrier projection AND the delivery
 * status/events, so the delivery query must be invalidated too — refetching
 * only the tracking payload left the badge and timeline stale. The mutation's
 * `isPending` (not the initial query's `isLoading`) drives the button label so
 * it always leaves "Tracking…" on success or failure.
 */
export function useShipmentTracking(
  shipmentId: string | null,
  deliveryId?: string | null,
) {
  const queryClient = useQueryClient();

  const query = useQuery<CourierTracking>({
    queryKey: ['shipment-tracking', shipmentId],
    queryFn: async () => {
      const res = await fetch(`/api/store/shipments/${shipmentId}/track`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch tracking');
      return json.data as CourierTracking;
    },
    enabled: !!shipmentId,
    staleTime: 60_000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/shipments/${shipmentId}/track`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to refresh tracking');
      return json.data as CourierTracking;
    },
    onSuccess: async (tracking) => {
      // Cache the payload the endpoint just returned instead of re-fetching it
      // (a second GET would hit the carrier again).
      queryClient.setQueryData(['shipment-tracking', shipmentId], tracking);

      // The tracking pipeline advances Delivery.status and writes
      // DeliveryEvent rows; refresh the detail (badge + timeline) and the list.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['delivery', deliveryId] }),
        queryClient.invalidateQueries({ queryKey: ['deliveries'] }),
      ]);
      toast.success('Tracking refreshed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefreshing: refreshMutation.isPending,
    error: refreshMutation.error,
    refresh: refreshMutation.mutate,
  };
}
