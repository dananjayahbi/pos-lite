'use client';

import { useQuery } from '@tanstack/react-query';

export function useProduct(productId: string) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await fetch(`/api/store/products/${productId}`);
      if (!res.ok) throw new Error('Failed to fetch product');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      return json.data;
    },
    staleTime: 30_000,
  });
}
