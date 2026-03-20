'use client';

import { useQuery } from '@tanstack/react-query';

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  _count: { products: number };
}

export function useCategories() {
  return useQuery<{ success: boolean; data: Category[] }>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/store/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: 60_000,
  });
}
