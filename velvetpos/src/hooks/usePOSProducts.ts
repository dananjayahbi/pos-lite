'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProductListItem } from '@/hooks/useProducts';

interface POSProductsResponse {
  success: boolean;
  data: ProductListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function usePOSProducts() {
  return useQuery<POSProductsResponse>({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const res = await fetch('/api/store/products?status=active&limit=1000');
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
