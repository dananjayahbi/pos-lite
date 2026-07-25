'use client';

import React from 'react';
import Link from 'next/link';
import type { PublicProduct } from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';
import { formatLKR } from '@/lib/utils';

interface CategoryProductGridProps {
  products: PublicProduct[];
  tenantSlug: string;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop';

function pickImage(p: PublicProduct): string {
  return (
    p.variants?.[0]?.imageUrls?.[0] ??
    p.primaryVariant?.imageUrls?.[0] ??
    FALLBACK_IMAGE
  );
}

function pickPrice(p: PublicProduct): number {
  return p.variants?.[0]?.retailPrice ?? p.primaryVariant?.retailPrice ?? 0;
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((p) => (
        <Link
          key={p.id}
          href={`${tenantHomePath(tenantSlug)}/product/${p.id}`}
          className="product-card group block"
        >
          <div className="product-card-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pickImage(p)}
              alt={p.name}
              className="primary"
              loading="lazy"
            />
          </div>
          <div className="p-3 text-center">
            <h4 className="text-xs md:text-sm font-medium mb-1 line-clamp-2">
              {p.name}
            </h4>
            <p className="text-sm font-semibold">{formatLKR(pickPrice(p))}</p>
            <button className="mt-2 w-full py-2 border border-black text-xs uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black hover:text-white">
              Add to Bag
            </button>
          </div>
        </Link>
      ))}
    </div>
  );
}
