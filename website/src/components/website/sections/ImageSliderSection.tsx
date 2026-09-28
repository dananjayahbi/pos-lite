'use client';

import React from 'react';
import type { ImageSliderSection as ImageSliderSectionConfig, PublicProduct } from '@/types/website.types';
import { DarkProductCard } from '@/components/website/sections/DarkProductCard';
import { DarkCarousel } from '@/components/website/sections/DarkCarousel';
import { SectionTitle } from '@/components/website/sections/SectionTitle';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';

interface ImageSliderSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  latestProducts?: PublicProduct[];
  bestSellingProducts?: PublicProduct[];
}

/**
 * Section 02 — "AUTHENTIC AYURVEDIC CARE / CURATED BOTANICAL COLLECTIONS".
 * A full-width horizontal slider of dark tilt product cards flanked by arrows,
 * with edge fades and a progress bar. The eyebrow / heading / subtitle texts
 * and the featured product selection are driven by ERP config (like the
 * "Top Selling Items" section). Falls back to config-supplied products or the
 * most recent products when no explicit pick is set.
 */
export function ImageSliderSection({
  tenantSlug,
  config,
  latestProducts,
  bestSellingProducts,
}: ImageSliderSectionProps) {
  const section = config as unknown as ImageSliderSectionConfig;

  // Featured products come from curated selection (productIds), else fall back
  // to the best-selling / latest products passed down from the data layer.
  let source = bestSellingProducts?.length ? bestSellingProducts : latestProducts ?? [];

  if (section.productIds && section.productIds.length > 0) {
    const idSet = new Set(section.productIds);
    source = source.filter((p) => idSet.has(p.id));
  }

  const display = source.slice(0, section.productCount || 7);
  if (display.length === 0) return null;

  return (
    <section id="products-section" className="section-dark relative w-full py-20 sm:py-28 lg:py-32 overflow-hidden">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-leaf', classes: 'top-10 left-6 text-6xl text-[#97c93e]', speed: 0.2 },
          { icon: 'fa-solid fa-seedling', classes: 'bottom-16 right-10 text-7xl text-emerald-400', speed: 0.32 },
          { icon: 'fa-solid fa-spa', classes: 'top-1/2 left-1/4 text-5xl text-lime-300', speed: 0.14 },
          { icon: 'fa-solid fa-cannabis', classes: 'top-20 right-1/4 text-4xl text-emerald-300', speed: 0.25 },
        ]}
      />

      <SectionTitle
        label={section.label || 'AUTHENTIC AYURVEDIC CARE'}
        title={section.title || 'CURATED BOTANICAL COLLECTIONS'}
        subtitle={
          section.subtitle ||
          'Handcrafted formulas extracted from Ceylon medicinal herbs to balance mind, body, and spirit. Click any product to explore detailed benefits.'
        }
      />

      <DarkCarousel sliderId="products" showProgress className="relative">
        {display.map((product, i) => (
          <DarkProductCard
            key={product.id}
            product={product}
            tenantSlug={tenantSlug}
            variant="tilt"
            index={i + 1}
            total={display.length}
          />
        ))}
      </DarkCarousel>
    </section>
  );
}
