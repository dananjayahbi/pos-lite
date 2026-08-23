import { useQuery } from '@tanstack/react-query';
import type { BatchExpiryStatus } from '@/lib/services/batchTracking.core';

export interface BatchListItem {
  id: string;
  variantId: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  source: 'PURCHASE' | 'MANUFACTURED';
  receivedAt: string;
  sku: string;
  productName: string;
  variantLabel: string;
  expiryStatus: BatchExpiryStatus;
}

export interface BatchListMeta {
  total: number;
  totalBatches: number;
  expiredCount: number;
  expiringSoonCount: number;
  healthyCount: number;
}

interface BatchListResponse {
  success: boolean;
  data: BatchListItem[];
  meta: BatchListMeta;
}

export interface BatchFilters {
  search?: string;
  variantId?: string;
  source?: string;
  expiryStatus?: string;
  page?: number;
  limit?: number;
}

export function useBatches(filters: BatchFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.variantId) params.set('variantId', filters.variantId);
  if (filters.source) params.set('source', filters.source);
  if (filters.expiryStatus) params.set('expiryStatus', filters.expiryStatus);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery<BatchListResponse>({
    queryKey: ['batches', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/store/batches?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch batches');
      return res.json();
    },
  });
}
