'use client';

import React from 'react';
import type { PublicProduct } from '@/types/website.types';
import { DarkProductCard } from '@/components/website/sections/DarkProductCard';
import { DarkCarousel } from '@/components/website/sections/DarkCarousel';
import { SectionTitle } from '@/components/website/sections/SectionTitle';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';

interface ImageSliderSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  latestProducts?: PublicProduct[];
}

/**
 * Section 03 — "CURATED BOTANICAL COLLECTIONS".
 * A full-width horizontal slider of dark tilt product cards flanked by arrows,
 * with edge fades and a progress bar. Uses the latest/config images or products.
 */
export function ImageSliderSection({
  tenantSlug,
  latestProducts,
}: ImageSliderSectionProps) {
  const products = latestProducts ?? [];
  const display = products.slice(0, 7);

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
        label="AUTHENTIC AYURVEDIC CARE"
        title="CURATED BOTANICAL COLLECTIONS"
        subtitle="Handcrafted formulas extracted from Ceylon medicinal herbs to balance mind, body, and spirit. Click any product to explore detailed benefits."
      />

      <DarkCarousel sliderId="products" showProgress className="relative">
        {display.map((product) => (
          <DarkProductCard
            key={product.id}
            product={product}
            tenantSlug={tenantSlug}
            variant="tilt"
          />
        ))}
      </DarkCarousel>
    </section>
  );
}
