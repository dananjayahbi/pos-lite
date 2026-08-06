'use client';

import type {
  BestSellingSection,
  PublicProduct,
} from '@/types/website.types';
import { ProductCard } from '@/components/website/cart/ProductCard';
import { CarouselSlider } from '@/components/website/sections/CarouselSlider';

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
  return (
    product.variants?.[0]?.retailPrice ??
    product.primaryVariant?.retailPrice ??
    0
  );
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

export function BestSelling({
  config,
  websiteConfig: _websiteConfig,
  tenantSlug,
  bestSellingProducts,
}: BestSellingProps) {
  const sectionConfig = config as unknown as BestSellingSection;

  // ── Data source ──────────────────────────────────────────────────────
  let source = bestSellingProducts ?? [];

  // If specific product IDs are configured, filter to only those.
  if (sectionConfig.productIds && sectionConfig.productIds.length > 0) {
    const idSet = new Set(sectionConfig.productIds);
    source = source.filter((p) => idSet.has(p.id));
  }

  const display = source.slice(0, sectionConfig.productCount || 7);

  if (display.length === 0) return null;

  const title = sectionConfig.title || 'Top Selling Items This Week';

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <section className="best-selling-section max-h-[525px] overflow-hidden">
      {/* Section title */}
      <h2 className="section-title">{title}</h2>

      <CarouselSlider
        sliderId="best-selling"
        desktopCards={4}
        tabletCards={3}
        mobileCards={2}
        gap={16}
        className="mt-4"
      >
        {display.map((product) => {
          const img = pickDisplayImage(product);
          return (
            <ProductCard
              key={product.id}
              product={product}
              tenantSlug={tenantSlug}
              {...(img ? { imageOverride: img } : {})}
              priceOverride={pickDisplayPrice(product)}
            />
          );
        })}
      </CarouselSlider>

      {/* ── Section-title styling ─────────────────────────────────────── */}
      <style jsx>{`
        .section-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #1a1a1a;
          margin-bottom: 4px;
          padding: 0 16px;
        }

        @media (max-width: 768px) {
          .section-title {
            font-size: 18px;
            padding: 0 12px;
          }
        }
      `}</style>
    </section>
  );
}