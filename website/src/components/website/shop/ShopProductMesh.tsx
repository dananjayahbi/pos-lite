'use client';

import React from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';
import type { PublicProduct } from '@/types/website.types';
import { ShopProductCard } from './ShopProductCard';

interface ShopProductMeshProps {
  products: PublicProduct[];
  tenantSlug: string;
}

/**
 * Responsive product mesh grid for the shop page (reference:
 * `#shop-product-grid`). Renders a dedicated empty state when the catalog
 * returns nothing.
 */
export function ShopProductMesh({ products, tenantSlug }: ShopProductMeshProps) {
  const revealRef = useRevealOnScroll<HTMLDivElement>();

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[#94a3b8]">No products found.</p>
      </div>
    );
  }

  return (
    <div ref={revealRef} id="shop-product-grid" className="shop-product-grid">
      {products.map((product) => (
        <ShopProductCard key={product.id} product={product} tenantSlug={tenantSlug} />
      ))}
    </div>
  );
}
