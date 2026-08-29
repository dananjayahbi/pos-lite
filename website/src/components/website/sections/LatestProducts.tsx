'use client';

import React from 'react';
import Link from 'next/link';
import type { LatestProductsSection, PublicProduct } from '@/types/website.types';
import { SectionTitle } from '@/components/website/sections/SectionTitle';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';
import { ROUTES } from '@/config/site';
import { formatLKR } from '@/lib/utils';

interface LatestProductsProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  latestProducts?: PublicProduct[];
}

function pickDisplayImage(product: PublicProduct): string | undefined {
  return (
    product.mainImageUrl ??
    product.variants?.[0]?.imageUrls?.[0] ??
    product.primaryVariant?.imageUrls?.[0]
  );
}
function pickDisplayPrice(product: PublicProduct): number {
  return product.variants?.[0]?.retailPrice ?? product.primaryVariant?.retailPrice ?? 0;
}

/**
 * Section 07 — "LATEST PRODUCTS" asymmetric editorial grid.
 * Desktop: 12-col asymmetric mesh (feature 7-col + 5/3 mix). Collapses to
 * 2-col (tablet) / 1-col (mobile). Glassmorphic cards with image aura + glare.
 */
export function LatestProducts({ config, tenantSlug, latestProducts }: LatestProductsProps) {
  const section = config as unknown as LatestProductsSection;

  let source = latestProducts ?? [];
  if (section.productIds && section.productIds.length > 0) {
    const idSet = new Set(section.productIds);
    source = source.filter((p) => idSet.has(p.id));
  }
  const display = source.slice(0, section.productCount || 7);
  if (display.length === 0) return null;

  const title = section.title || 'Latest Products';

  return (
    <section id="latest-products-section" className="section-dark relative w-full py-20 sm:py-28 lg:py-36 overflow-hidden">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-leaf', classes: 'top-12 left-10 text-6xl text-[#97c93e]', speed: 0.22 },
          { icon: 'fa-solid fa-seedling', classes: 'bottom-20 right-8 text-7xl text-emerald-400', speed: 0.3 },
          { icon: 'fa-solid fa-spa', classes: 'top-1/2 left-4 text-4xl text-lime-300', speed: 0.16 },
        ]}
        glows={['top-0 right-1/4 w-96 h-96 bg-[#97c93e]/10', 'bottom-10 left-1/3 w-80 h-80 bg-emerald-500/10']}
      />

      <SectionTitle label="NEW HERBAL ARRIVALS" title={title} />

      <div className="reveal-on-scroll relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="latest-editorial-grid">
          {display.map((product, i) => (
            <Link
              key={product.id}
              href={ROUTES.product(tenantSlug, product.id)}
              className={`latest-product-card latest-mesh-${i + 1} group select-none`}
            >
              <div className="latest-img-frame">
                {pickDisplayImage(product) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pickDisplayImage(product)}
                    alt={product.name}
                    loading="lazy"
                    className="latest-product-img"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                    Image unavailable
                  </div>
                )}
                <div className="latest-img-aura" />
                <div className="latest-glare-overlay" />
              </div>
              <div className="latest-content">
                <h3 className="latest-title">{product.name}</h3>
                <div className="latest-price-row">
                  <span className="latest-price">{formatLKR(pickDisplayPrice(product))}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
