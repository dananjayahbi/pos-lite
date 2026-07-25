/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import type { CategoriesSection, PublicCategory } from '@/types/website.types';
import { ROUTES } from '@/config/site';
import { CarouselSlider } from '@/components/website/sections/CarouselSlider';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryGridProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  /** Real category data passed from the parent page / data-fetching layer. */
  categories?: PublicCategory[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryGrid({
  config,
  websiteConfig: _websiteConfig,
  tenantSlug,
  categories,
}: CategoryGridProps) {
  const sectionConfig = config as unknown as CategoriesSection;

  // ── Data source ──────────────────────────────────────────────────────
  let source = categories ?? [];

  // If specific category IDs are configured, filter to only those.
  if (sectionConfig.categoryIds && sectionConfig.categoryIds.length > 0) {
    const idSet = new Set(sectionConfig.categoryIds);
    source = source.filter((c) => idSet.has(c.id));
  }

  const display = source.slice(0, 5);

  if (display.length === 0) return null;

  const title = sectionConfig.title || 'Top Categories';

  // ── Helpers ──────────────────────────────────────────────────────────
  function getImageUrl(cat: PublicCategory): string | undefined {
    // Allow override images from section config
    const override = sectionConfig.categoryImages?.[cat.id];
    if (override) return override;
    return cat.imageUrl;
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <section className="category-grid-section">
      {/* Section title */}
      <h2 className="section-title">{title}</h2>

      <CarouselSlider
        sliderId="category-grid"
        desktopCards={4}
        tabletCards={3}
        mobileCards={2}
        gap={16}
        className="mt-4"
      >
        {display.map((cat) => {
          const img = getImageUrl(cat);

          return (
            <Link
              key={cat.id}
              href={ROUTES.category(tenantSlug, cat.id)}
              className="category-card"
            >
              <div className="image-wrapper">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={cat.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-gray-100 text-xs text-gray-400">
                    No image
                  </div>
                )}
              </div>

              <div className="category-info">
                <h3 className="category-title">{cat.name}</h3>
                {cat.productCount != null && (
                  <span className="product-count">
                    {cat.productCount}{' '}
                    {cat.productCount === 1 ? 'Product' : 'Products'}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </CarouselSlider>

      {/* ── Card styling (image wrapper, hover, typography) ──────────── */}
      <style jsx>{`
        /* Section title */
        .section-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #1a1a1a;
          margin-bottom: 4px;
          padding: 0 16px;
        }

        /* Category card */
        .category-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-decoration: none;
          color: #333333;
        }

        /* Square image wrapper */
        .image-wrapper {
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background-color: #f5f5f5;
        }

        .image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.3s ease;
        }

        .category-card:hover .image-wrapper img {
          transform: scale(1.03);
        }

        /* Typography */
        .category-info {
          text-align: center;
          margin-top: 14px;
        }

        .category-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #2b2b2b;
          margin-bottom: 4px;
        }

        .product-count {
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #8e8e8e;
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