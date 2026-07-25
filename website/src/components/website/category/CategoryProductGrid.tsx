'use client';

import React from 'react';
import type { PublicProduct } from '@/types/website.types';
import { ProductCard } from '@/components/website/cart/ProductCard';

interface CategoryProductGridProps {
  products: PublicProduct[];
  tenantSlug: string;
}

/**
 * Responsive product grid for category listing pages.
 */
export function CategoryProductGrid({ products, tenantSlug }: CategoryProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500">
        <p>No products found in this category.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} tenantSlug={tenantSlug} />
      ))}
    </div>
  );
}
