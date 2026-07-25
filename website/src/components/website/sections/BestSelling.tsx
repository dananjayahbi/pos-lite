'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BestSellingSection, PublicProduct } from '@/types/website.types';
import { ProductCard } from '@/components/website/cart/ProductCard';

interface BestSellingProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
  products?: PublicProduct[];
}

function pickDisplayImage(p: PublicProduct): string {
  return (
    p.variants?.[0]?.imageUrls?.[0] ??
    p.primaryVariant?.imageUrls?.[0] ??
    'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop'
  );
}

function pickDisplayPrice(p: PublicProduct): number {
  return (
    p.variants?.[0]?.retailPrice ??
    p.primaryVariant?.retailPrice ??
    0
  );
}

/**
 * Best-selling products carousel. When `products` is provided (from the ERP
 * API) it is rendered; otherwise falls back to placeholder fixtures.
 */
export function BestSelling({ config, tenantSlug, products }: BestSellingProps) {
  const sectionConfig = config as unknown as BestSellingSection;
  const [scrollIndex, setScrollIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(2);

  // Responsive items per view
  React.useEffect(() => {
    const compute = () => setItemsPerView(window.innerWidth >= 768 ? 5 : 2);
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const source: PublicProduct[] = products ?? [];
  const display = source.slice(0, sectionConfig.productCount || 10);

  const maxIndex = Math.max(0, display.length - itemsPerView);

  const scroll = (direction: 'left' | 'right') => {
    setScrollIndex((prev) => {
      if (direction === 'left') return Math.max(0, prev - 1);
      return Math.min(maxIndex, prev + 1);
    });
  };

  if (display.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {sectionConfig.title && (
          <div className="section-title">
            <h3 className="section-title-main">{sectionConfig.title}</h3>
          </div>
        )}

        <div className="relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${scrollIndex * (100 / itemsPerView)}%)` }}
            >
              {display.map((product) => (
                <div
                  key={product.id}
                  className="flex-shrink-0 px-2"
                  style={{ width: `${100 / itemsPerView}%` }}
                >
                  <ProductCard
                    product={product}
                    tenantSlug={tenantSlug}
                    imageOverride={pickDisplayImage(product)}
                    priceOverride={pickDisplayPrice(product)}
                  />
                </div>
              ))}
            </div>
          </div>

          {display.length > itemsPerView && (
            <>
              <button
                onClick={() => scroll('left')}
                disabled={scrollIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors z-10"
                aria-label="Previous products"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={scrollIndex >= maxIndex}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors z-10"
                aria-label="Next products"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}