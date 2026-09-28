'use client';

import React from 'react';
import type { BestSellingSection, PublicProduct } from '@/types/website.types';
import { DarkProductCard } from '@/components/website/sections/DarkProductCard';
import { DarkCarousel } from '@/components/website/sections/DarkCarousel';
import { SectionTitle } from '@/components/website/sections/SectionTitle';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BestSellingProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  /** Real product data passed from the parent page / data-fetching layer. */
  bestSellingProducts?: PublicProduct[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Section 04 — "TOP SELLING ITEMS" swipeable pill-silhouette carousel.
 */
export function BestSelling({
  config,
  tenantSlug,
  bestSellingProducts,
}: BestSellingProps) {
  const sectionConfig = config as unknown as BestSellingSection;

  let source = bestSellingProducts ?? [];

  if (sectionConfig.productIds && sectionConfig.productIds.length > 0) {
    const idSet = new Set(sectionConfig.productIds);
    source = source.filter((p) => idSet.has(p.id));
  }

  const display = source.slice(0, sectionConfig.productCount || 7);

  if (display.length === 0) return null;

  const title = sectionConfig.title || 'Top Selling Items';
  const label = sectionConfig.label || 'MOST LOVED BOTANICAL REMEDIES';

  return (
    <section id="top-selling-section" className="section-dark relative w-full py-20 sm:py-28 lg:py-32 overflow-hidden">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-seedling', classes: 'top-12 left-8 text-6xl text-[#97c93e]', speed: 0.22 },
          { icon: 'fa-solid fa-leaf', classes: 'bottom-20 right-10 text-7xl text-emerald-400', speed: 0.3 },
          { icon: 'fa-solid fa-spa', classes: 'top-1/3 right-1/4 text-5xl text-lime-300', speed: 0.16 },
          { icon: 'fa-solid fa-cannabis', classes: 'bottom-12 left-1/4 text-4xl text-emerald-300', speed: 0.26 },
        ]}
        glows={['-top-20 left-1/3 w-96 h-96 bg-[#97c93e]', 'bottom-0 right-1/4 w-80 h-80 bg-emerald-500']}
      />

      <SectionTitle
        label={label}
        title={title}
        reveal
      />

      <DarkCarousel sliderId="top-selling" showProgress>
        {display.map((product) => {
          const img = pickDisplayImage(product);
          return (
            <DarkProductCard
              key={product.id}
              product={product}
              tenantSlug={tenantSlug}
              variant="pill"
              {...(img ? { imageOverride: img } : {})}
              priceOverride={pickDisplayPrice(product)}
            />
          );
        })}
      </DarkCarousel>
    </section>
  );
}