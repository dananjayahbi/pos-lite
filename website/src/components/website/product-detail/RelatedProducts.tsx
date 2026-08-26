'use client';

import React from 'react';
import Link from 'next/link';
import type { PublicProduct } from '@/types/website.types';
import { ROUTES } from '@/config/site';
import { formatLKR } from '@/lib/utils';

interface RelatedProductsProps {
  products: PublicProduct[];
  tenantSlug: string;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop';

function pickImage(p: PublicProduct): string {
  return (
    p.mainImageUrl ??
    p.variants?.[0]?.imageUrls?.[0] ??
    p.primaryVariant?.imageUrls?.[0] ??
    FALLBACK_IMAGE
  );
}

function pickPrice(p: PublicProduct): number {
  return p.variants?.[0]?.retailPrice ?? p.primaryVariant?.retailPrice ?? 0;
}

/**
 * Horizontal grid of related / similar products.
 */
export function RelatedProducts({ products, tenantSlug }: RelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <h2
          className="text-xl md:text-2xl mb-6"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          You may also like
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={ROUTES.product(tenantSlug, p.id)}
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
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
