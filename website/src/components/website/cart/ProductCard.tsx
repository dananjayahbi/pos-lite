"use client";

/**
 * Compact product card used in carousels (Best Selling / Latest Products)
 * and category grids.
 *
 * Structure:
 *   <article>
 *     <Link>          ← wraps image + title + price (navigates to product)
 *     <AddToCartButton/>  ← sibling, NOT inside the link
 *   </article>
 *
 * Why split the link and the button? Putting an interactive element
 * (`<button>`) inside an `<a>` is invalid HTML, and browsers disagree
 * about whether clicks should navigate. Siblinging them sidesteps the
 * whole mess — and the AddToCartButton handles its own `e.stopPropagation`
 * as a defensive fallback.
 */

import React from 'react';
import Link from 'next/link';
import type { PublicProduct, PublicProductVariant } from '@/types/website.types';
import { ROUTES } from '@/config/site';
import { formatLKR } from '@/lib/utils';
import { AddToCartButton } from './AddToCartButton';

interface ProductCardProps {
  product: PublicProduct;
  tenantSlug: string;
  /** Optional override for the displayed image URL. */
  imageOverride?: string;
  /** Optional override for the displayed price (in LKR). */
  priceOverride?: number;
}

function pickImage(p: PublicProduct): string | undefined {
  return p.variants?.[0]?.imageUrls?.[0] ?? p.primaryVariant?.imageUrls?.[0];
}

function pickVariant(p: PublicProduct): PublicProductVariant | undefined {
  return p.primaryVariant ?? p.variants?.[0];
}

function pickPrice(p: PublicProduct): number {
  return (
    p.variants?.[0]?.retailPrice ??
    p.primaryVariant?.retailPrice ??
    0
  );
}

export function ProductCard({
  product,
  tenantSlug,
  imageOverride,
  priceOverride,
}: ProductCardProps) {
  const image = imageOverride ?? pickImage(product);
  const price = priceOverride ?? pickPrice(product);
  const variant = pickVariant(product);
  const inStock = (variant?.stockQuantity ?? 0) > 0;

  return (
    <article className="product-card group flex h-full flex-col">
      <Link
        href={ROUTES.product(tenantSlug, product.id)}
        className="flex flex-1 flex-col"
      >
        <div className="product-card-image">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              className="primary object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-xs text-gray-400">
              Image unavailable
            </div>
          )}
        </div>
        <div className="p-3 text-center">
          <h4 className="mb-1 line-clamp-2 text-xs font-medium md:text-sm">
            {product.name}
          </h4>
          <p className="text-sm font-semibold">{formatLKR(price)}</p>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <AddToCartButton
            tenantSlug={tenantSlug}
            variant={variant}
            product={{ id: product.id, name: product.name }}
            size="md"
            variantStyle="outline"
            className="w-full"
            hideIcon
          />
        </div>
        {!inStock && (
          <p className="mt-1 text-center text-[11px] text-red-600">Out of stock</p>
        )}
      </div>
    </article>
  );
}