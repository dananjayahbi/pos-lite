'use client';

import React, { useState } from 'react';
import type { PublicProductVariant } from '@/types/website.types';

interface ProductGalleryProps {
  variants: PublicProductVariant[];
  productName: string;
  /** Product-level main image, shown first when present. */
  mainImageUrl?: string | undefined;
}

/**
 * Image gallery with thumbnail strip. Collects all unique image URLs
 * across every variant and lets the visitor browse them.
 */
export function ProductGallery({ variants, productName, mainImageUrl }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const safeVariants = variants ?? [];
  const images = Array.from(
    new Set(
      [
        ...(mainImageUrl ? [mainImageUrl] : []),
        ...safeVariants.flatMap((v) => v.imageUrls ?? []),
      ],
    ),
  );

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-[#082017] text-sm text-[#64748b]">
        Image unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-[#082017]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={productName}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === active ? 'border-[#97c93e]' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${productName} thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
