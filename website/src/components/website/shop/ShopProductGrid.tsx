'use client';

import React from 'react';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';
import { formatLKR } from '@/lib/utils';
import type { PublicProduct } from '@/types/website.types';

interface ShopProductGridProps {
  products: PublicProduct[];
  tenantSlug: string;
}

function pickImage(product: PublicProduct): string | null {
  return product.primaryVariant?.imageUrls?.[0] ?? product.variants?.[0]?.imageUrls?.[0] ?? null;
}

function pickPrice(product: PublicProduct): number {
  return (
    product.primaryVariant?.retailPrice ??
    product.variants?.[0]?.retailPrice ??
    0
  );
}

/**
 * Responsive product grid for the shop page.
 */
export function ShopProductGrid({ products, tenantSlug }: ShopProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-sm">No products found.</p>
      </div>
    );
  }

  const homePath = tenantHomePath(tenantSlug);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`${homePath}/product/${product.id}`}
          className="product-card group"
        >
          <div className="product-card-image aspect-square overflow-hidden rounded-lg bg-gray-100">
            {pickImage(product) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pickImage(product) ?? undefined}
                alt={product.name}
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                Image unavailable
              </div>
            )}
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {product.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {formatLKR(pickPrice(product))}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
