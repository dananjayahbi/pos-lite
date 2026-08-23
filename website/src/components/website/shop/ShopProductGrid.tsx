'use client';

import React from 'react';
import type { PublicProduct } from '@/types/website.types';
import { ProductCard } from '@/components/website/cart/ProductCard';

interface ShopProductGridProps {
  products: PublicProduct[];
  tenantSlug: string;
  /** Optional active search term, rendered as a results header. */
  query?: string | undefined;
}

/**
 * Responsive product grid for the shop page, with a "results for" header when
 * a search term is active and a dedicated empty state for that case.
 */
export function ShopProductGrid({
  products,
  tenantSlug,
  query,
}: ShopProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-gray-500">
          {query
            ? `No products found for "${query}".`
            : 'No products found.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {query && (
        <p className="mb-4 text-sm text-gray-600">
          Results for <span className="font-medium">&quot;{query}&quot;</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 md:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} tenantSlug={tenantSlug} />
        ))}
      </div>
    </div>
  );
}
