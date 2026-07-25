'use client';

import React from 'react';
import type { PublicProduct } from '@/types/website.types';
import { ProductCard } from '@/components/website/cart/ProductCard';

interface ShopProductGridProps {
  products: PublicProduct[];
  tenantSlug: string;
}

/**
 * Responsive product grid for the shop page.
 */
export function ShopProductGrid({ products, tenantSlug }: ShopProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-gray-500">No products found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 md:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} tenantSlug={tenantSlug} />
      ))}
    </div>
  );
}
