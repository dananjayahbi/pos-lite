'use client';

import { useQuery } from '@tanstack/react-query';

interface LowStockFilters {
  page?: number | undefined;
  limit?: number | undefined;
  threshold?: number | undefined;
}

interface LowStockVariant {
  id: string;
  sku: string;
  size: string | null;
  colour: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  retail_price: string;
  product_name: string;
  category_name: string;
  shortfall: number;
}

interface LowStockResponse {
  success: boolean;
  data: LowStockVariant[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type { LowStockVariant, LowStockFilters };

export function useLowStockVariants(filters: LowStockFilters) {
  return useQuery<LowStockResponse>({
    queryKey: ['low-stock-variants', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.threshold) params.set('threshold', String(filters.threshold));
      const res = await fetch(`/api/store/stock-control/low-stock?${params}`);
      if (!res.ok) throw new Error('Failed to fetch low stock variants');
      return res.json();
    },
    staleTime: 30_000,
  });
}
