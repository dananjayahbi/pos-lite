'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface ProductFilters {
  search?: string | undefined;
  categoryId?: string | undefined;
  categories?: string | undefined;
  brandId?: string | undefined;
  brands?: string | undefined;
  gender?: string | undefined;
  genders?: string | undefined;
  isArchived?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface ProductListItem {
  id: string;
  name: string;
  description: string | null;
  gender: string;
  isArchived: boolean;
  tags: string[];
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  _count: { variants: number };
  variants?: Array<{
    id: string;
    stockQuantity: number;
    lowStockThreshold: number;
    imageUrls: string[];
    retailPrice: number;
  }>;
}

interface ProductListResponse {
  success: boolean;
  data: ProductListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useProducts(filters: ProductFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.brandId) params.set('brandId', filters.brandId);
  if (filters.gender) params.set('gender', filters.gender);
  if (filters.isArchived) params.set('isArchived', filters.isArchived);
  if (filters.categories) params.set('categories', filters.categories);
  if (filters.brands) params.set('brands', filters.brands);
  if (filters.genders) params.set('genders', filters.genders);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  const queryString = params.toString();

  return useQuery<ProductListResponse>({
    queryKey: ['products', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/store/products?${queryString}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
