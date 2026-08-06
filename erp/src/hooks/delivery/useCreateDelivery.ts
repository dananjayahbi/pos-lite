'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useCreateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/store/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to create delivery');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Delivery created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
