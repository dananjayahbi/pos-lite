'use client';

import { useQuery } from '@tanstack/react-query';

export interface Brand {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  _count: { products: number };
}

export function useBrands() {
  return useQuery<{ success: boolean; data: Brand[] }>({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await fetch('/api/store/brands');
      if (!res.ok) throw new Error('Failed to fetch brands');
      return res.json();
    },
    staleTime: 60_000,
  });
}
