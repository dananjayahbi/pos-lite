'use client';

import { useQuery } from '@tanstack/react-query';

interface POSCategory {
  id: string;
  name: string;
}

export function usePOSCategories() {
  return useQuery<POSCategory[]>({
    queryKey: ['pos-categories'],
    queryFn: async () => {
      const res = await fetch('/api/store/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const json = await res.json();
      return (json.data ?? []) as POSCategory[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
