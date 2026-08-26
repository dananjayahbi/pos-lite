'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DeliveryStatus } from '@/generated/prisma/client';
import type { BulkResultItem } from '@/lib/validators/order.validators';

/** Fetch orders (deliveries) for the Orders management page. */
export function useOrders(filters: { status?: DeliveryStatus | null; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const res = await fetch(`/api/store/deliveries?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch orders');
      return json.data as {
        items: unknown[];
        total: number;
        page: number;
        limit: number;
      };
    },
    staleTime: 30_000,
  });
}

/** Bulk status change for selected orders. */
export function useBulkStatusChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { deliveryIds: string[]; status: DeliveryStatus }) => {
      const res = await fetch('/api/store/orders/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Bulk status change failed');
      return json.data as BulkResultItem[];
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      const ok = results.filter((r) => r.ok).length;
      toast.success(`Updated ${ok} order(s)`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/** Bulk "prepare for delivery" for selected orders. */
export function useBulkCreateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryIds: string[]) => {
      const res = await fetch('/api/store/orders/bulk-create-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryIds }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Bulk create delivery failed');
      return json.data as BulkResultItem[];
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      const ok = results.filter((r) => r.ok).length;
      toast.success(`Prepared ${ok} order(s) for delivery`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
