'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useShipmentTracking(shipmentId: string | null) {
  const query = useQuery({
    queryKey: ['shipment-tracking', shipmentId],
    queryFn: async () => {
      const res = await fetch(`/api/store/shipments/${shipmentId}/track`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch tracking');
      return json.data;
    },
    enabled: !!shipmentId,
    staleTime: 60_000,
  });

  const refetch = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/shipments/${shipmentId}/track`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to refresh tracking');
      return json.data;
    },
    onSuccess: () => {
      query.refetch();
      toast.success('Tracking refreshed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { data: query.data, isLoading: query.isLoading, refresh: refetch.mutate };
}
