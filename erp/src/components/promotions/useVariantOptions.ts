'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * M15-01 (BUG-46) — variant options for the customer pricing rule dialog.
 *
 * Reuses the existing store product list (`GET /api/store/products`), which
 * already returns variants with name/SKU/retail price per product — the same
 * source `BomFormDialog` uses to build a variant picker, so no new endpoint or
 * hook was introduced. An empty selection is meaningful: it means "all
 * variants" (the API's NULL variantId).
 */

export interface VariantOption {
  id: string;
  label: string;
  retailPrice: string | number;
}

interface ProductWithVariants {
  name: string;
  variants?: Array<{ id: string; sku: string; retailPrice: string | number }>;
}

export function useVariantOptions() {
  return useQuery<VariantOption[]>({
    queryKey: ['customer-pricing-variant-options'],
    queryFn: async () => {
      const res = await fetch('/api/store/products?limit=100');
      if (!res.ok) return [];
      const json = await res.json();
      const products = (json.data ?? []) as ProductWithVariants[];
      return products.flatMap((product) =>
        (product.variants ?? []).map((variant) => ({
          id: variant.id,
          label: `${product.name} — ${variant.sku}`,
          retailPrice: variant.retailPrice,
        })),
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}