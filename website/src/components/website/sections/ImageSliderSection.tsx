'use client';

import React from 'react';
import Link from 'next/link';
import { CarouselSlider } from '@/components/website/sections/CarouselSlider';
import type {
  ImageSliderSection as ImageSliderSectionConfig,
  ImageSliderItem,
} from '@/types/website.types';

interface ImageSliderSectionProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Section 02 — Horizontal image slider.
 * - 100% width, max-height 400px
 * - Uses shared CarouselSlider for scroll-snap horizontal sliding
 * - Up to 7 configurable images, filtered to active only
 * - Each card fills its container with object-fit: cover
 * - Optional linkUrl wraps image in anchor tag
 * - 8px gap below via mb-[8px]
 */
export function ImageSliderSection({ config }: ImageSliderSectionProps) {
  const section = config as unknown as ImageSliderSectionConfig;

  if (!section.isActive) return null;

  const activeImages: ImageSliderItem[] = (section.images ?? [])
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 7);

  if (activeImages.length === 0) return null;

  const cards = activeImages.map((item, idx) => {
    const imgElement = (
      <img
        src={item.imageUrl}
        alt={item.alt || ''}
        className="w-full h-full object-cover"
        loading={idx < 3 ? 'eager' : 'lazy'}
      />
    );

    const card = (
      <div className="image-slider-card" key={idx}>
        {item.linkUrl ? (
          <Link
            href={item.linkUrl}
            className="block w-full h-full"
            aria-label={item.alt || 'Slider image'}
          >
            {imgElement}
          </Link>
        ) : (
          imgElement
        )}
      </div>
    );

    return card;
  });

  return (
    <section className="image-slider-section mb-[8px]">
      <CarouselSlider
        sliderId="image-slider"
        desktopCards={3}
        tabletCards={2}
        mobileCards={1}
        gap={8}
      >
        {cards}
      </CarouselSlider>

      <style jsx>{`
        .image-slider-section {
          width: 100%;
          overflow: hidden;
        }

        :global(.image-slider-card) {
          aspect-ratio: 16 / 9;
          max-height: 400px;
          overflow: hidden;
          border-radius: 4px;
        }

        :global(.image-slider-card img) {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        @media (max-width: 600px) {
          :global(.image-slider-card) {
            max-height: 280px;
          }
        }
      `}</style>
    </section>
  );
}
