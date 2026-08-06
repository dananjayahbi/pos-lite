'use client';

import React from 'react';
import type { ImageSliderSection } from '@/types/website.types';

interface ImageSliderPreviewProps {
  config: Record<string, unknown>;
  websiteConfig: Record<string, unknown>;
  tenantSlug: string;
}

/**
 * Lightweight ERP preview for the Image Slider section (Section 02).
 * Renders a simple strip of the configured slider images.
 */
export function ImageSliderPreview({ config }: ImageSliderPreviewProps) {
  const sectionConfig = config as unknown as ImageSliderSection;
  const images = (sectionConfig.images ?? []).filter((img) => img.imageUrl);

  if (images.length === 0) return null;

  return (
    <section className="bg-white py-6">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex gap-3 overflow-x-auto">
          {images.slice(0, 7).map((img, idx) => (
            <div key={idx} className="min-w-[180px] shrink-0">
              <img
                src={img.imageUrl}
                alt={img.alt ?? ''}
                className="h-32 w-full rounded-lg object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
