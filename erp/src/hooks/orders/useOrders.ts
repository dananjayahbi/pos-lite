'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DeliveryStatus } from '@/generated/prisma/client';
import type { BulkResultItem } from '@/lib/validators/order.validators';
import { bulkResultToast } from '@/components/orders/bulkResult';

function toastBulkResult(results: BulkResultItem[], action: string) {
  const { level, message } = bulkResultToast(results, action);
  if (level === 'success') toast.success(message);
  else if (level === 'warning') toast.warning(message);
  else toast.error(message);
}

export const ORDERS_PAGE_SIZE = 50;

/** Fetch orders (deliveries) for the Orders management page. */
export function useOrders(
  filters: {
    status?: DeliveryStatus | null;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? ORDERS_PAGE_SIZE;
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  // ARGUS #262: without an explicit page the API caps the response at its
  // default 50, making rows 51+ unreachable.
  params.set('page', String(page));
  params.set('limit', String(limit));

  const queryFilters = {
    status: filters.status ?? null,
    search: filters.search ?? '',
    page,
    limit,
  };

  return useQuery({
    queryKey: ['orders', queryFilters],
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
    placeholderData: keepPreviousData,
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
      // ARGUS #265: report per-id rejections, not just the OK count.
      toastBulkResult(results, 'Updated');
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
      // ARGUS #265: prepare failures (already dispatched, wrong status) used to
      // disappear behind a success toast that only counted the OK rows.
      toastBulkResult(results, 'Prepared for delivery');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
