'use client';

import { useQuery } from '@tanstack/react-query';

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  imageUrl: string | null;
  deletedAt?: string | null;
  _count: { products: number };
}

/**
 * Active categories by default. `deleted` switches to the soft-deleted set
 * used by the Deleted view and restore action (ARGUS #172).
 */
export function useCategories(deleted = false) {
  return useQuery<{ success: boolean; data: Category[] }>({
    queryKey: ['categories', deleted ? 'deleted' : 'active'],
    queryFn: async () => {
      const res = await fetch(
        deleted ? '/api/store/categories?deleted=true' : '/api/store/categories',
      );
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: 60_000,
  });
}
