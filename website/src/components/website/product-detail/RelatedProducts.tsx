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
          className="text-xl md:text-2xl mb-6 text-white"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          You may also like
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={ROUTES.product(tenantSlug, p.id)}
              className="product-card group block rounded-xl border border-white/10 bg-[#082017] p-3"
            >
              <div className="product-card-image aspect-square overflow-hidden rounded-lg bg-[#051610] ring-1 ring-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pickImage(p)}
                  alt={p.name}
                  className="primary object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-3 text-center">
                <h4
                  className="text-xs md:text-sm font-medium mb-1 line-clamp-2 text-white"
                  style={{ fontFamily: 'var(--font-serif), serif' }}
                >
                  {p.name}
                </h4>
                <p className="text-sm font-semibold text-[#97c93e]">{formatLKR(pickPrice(p))}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
