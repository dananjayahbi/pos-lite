'use client';

import React, { useState } from 'react';
import type { PublicProductVariant } from '@/types/website.types';

interface ProductGalleryProps {
  variants: PublicProductVariant[];
  productName: string;
}

/**
 * Image gallery with thumbnail strip. Collects all unique image URLs
 * across every variant and lets the visitor browse them.
 */
export function ProductGallery({ variants, productName }: ProductGalleryProps) {
  const safeVariants = variants ?? [];
  const images = Array.from(
    new Set(safeVariants.flatMap((v) => v.imageUrls ?? [])),
  );

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
        Image unavailable
      </div>
    );
  }

  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
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
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 transition-colors ${
                i === active ? 'border-black' : 'border-transparent opacity-60 hover:opacity-100'
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
