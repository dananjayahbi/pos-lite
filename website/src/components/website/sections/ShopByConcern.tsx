/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ShopByConcernSection } from '@/types/website.types';

interface ShopByConcernProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/** Horizontal carousel of concern tiles (4 visible, left/right chevrons). */
export function ShopByConcern({ config }: ShopByConcernProps) {
  const sectionConfig = config as unknown as ShopByConcernSection;
  const items = sectionConfig.items ?? [];
  const [scrollIndex, setScrollIndex] = useState(0);
  const itemsPerView = 4;

  if (items.length === 0) return null;

  const maxIndex = Math.max(0, items.length - itemsPerView);

  const scroll = (direction: 'left' | 'right') => {
    setScrollIndex((prev) => {
      if (direction === 'left') return Math.max(0, prev - 1);
      return Math.min(maxIndex, prev + 1);
    });
  };

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {sectionConfig.title && (
          <div className="section-title">
            <h3 className="section-title-main">{sectionConfig.title}</h3>
          </div>
        )}

        <div className="relative">
          {/* Carousel container */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${scrollIndex * (100 / itemsPerView)}%)` }}
            >
              {items.map((item, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 px-2"
                  style={{ width: `${100 / itemsPerView}%` }}
                >
                  <Link
                    href={item.link || '#'}
                    className="category-card group block"
                  >
                    <div className="category-card-image">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3 text-center bg-white">
                      <h4 className="text-xs md:text-sm uppercase tracking-wider font-medium">
                        {item.name}
                      </h4>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          {items.length > itemsPerView && (
            <>
              <button
                onClick={() => scroll('left')}
                disabled={scrollIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors z-10"
                aria-label="Previous items"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={scrollIndex >= maxIndex}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors z-10"
                aria-label="Next items"
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