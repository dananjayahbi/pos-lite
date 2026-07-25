'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProductListItem } from '@/hooks/useProducts';

interface POSProductsResponse {
  success: boolean;
  data: ProductListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface UsePOSProductsOptions {
  categoryId: string | null;
  search: string;
  page: number;
}

const PAGE_SIZE = 24;

export function usePOSProducts({ categoryId, search, page }: UsePOSProductsOptions) {
  const params = new URLSearchParams({ status: 'active', limit: String(PAGE_SIZE), page: String(page) });
  if (categoryId) params.set('categoryId', categoryId);
  if (search.trim()) params.set('search', search.trim());

  const query = useQuery<POSProductsResponse>({
    queryKey: ['pos-products', categoryId, search, page],
    queryFn: async () => {
      const res = await fetch(`/api/store/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Show loading state whenever data for this specific key is being fetched for the first time
  const isTransitioning = query.isFetching && !query.data;

  return { ...query, isTransitioning };
}
