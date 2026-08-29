'use client';

/**
 * Reference-styled shop product card (matches `shop.html` `.shop-card`).
 *
 * Structure mirrors the existing ProductCard contract — an `<article>` whose
 * inner `<Link>` wraps image + title + price so navigation still works, with a
 * sibling AddToCartButton (never nested inside the anchor).
 *
 * We reuse the reference `shop-card-*` CSS classes defined in globals.css so
 * the grid, hover lift and green glow match the reference shop.html exactly.
 */

import React from 'react';
import Link from 'next/link';
import type { PublicProduct, PublicProductVariant } from '@/types/website.types';
import { ROUTES } from '@/config/site';
import { formatLKR } from '@/lib/utils';
import { AddToCartButton } from '@/components/website/cart/AddToCartButton';

interface ShopProductCardProps {
  product: PublicProduct;
  tenantSlug: string;
}

function pickImage(p: PublicProduct): string | undefined {
  return p.mainImageUrl ?? p.variants?.[0]?.imageUrls?.[0] ?? p.primaryVariant?.imageUrls?.[0];
}

function pickVariant(p: PublicProduct): PublicProductVariant | undefined {
  return p.primaryVariant ?? p.variants?.[0];
}

function pickPrice(p: PublicProduct): number {
  return p.variants?.[0]?.retailPrice ?? p.primaryVariant?.retailPrice ?? 0;
}

export function ShopProductCard({ product, tenantSlug }: ShopProductCardProps) {
  const image = pickImage(product);
  const price = pickPrice(product);
  const variant = pickVariant(product);
  const inStock = (variant?.stockQuantity ?? 0) > 0;

  return (
    <article className="shop-card group">
      <Link href={ROUTES.product(tenantSlug, product.id)} className="flex flex-1 flex-col">
        <div className="shop-card-img-wrap">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              className="shop-card-img"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-xs text-[#64748b]">
              Image unavailable
            </div>
          )}
          <span className="shop-card-badge">{product.categoryId ? 'Formulation' : 'Botanical'}</span>
        </div>
        <h4 className="shop-card-title">{product.name}</h4>
        <p className="shop-card-price">{formatLKR(price)}</p>
      </Link>

      <div className="mt-3">
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <AddToCartButton
            tenantSlug={tenantSlug}
            variant={variant}
            product={{ id: product.id, name: product.name }}
            size="md"
            variantStyle="outline"
            className="shop-card-cta"
            hideIcon
          />
        </div>
        {!inStock && (
          <p className="mt-1 text-center text-[11px] text-red-400">Out of stock</p>
        )}
      </div>
    </article>
  );
}
