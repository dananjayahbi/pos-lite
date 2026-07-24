'use client';

import React, { useState } from 'react';
import type { PublicProductVariant } from '@/types/website.types';

interface ProductGalleryProps {
  variants: PublicProductVariant[];
  productName: string;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&h=600&fit=crop';

/**
 * Image gallery with thumbnail strip. Collects all unique image URLs
 * across every variant and lets the visitor browse them.
 */
export function ProductGallery({ variants, productName }: ProductGalleryProps) {
  const safeVariants = variants ?? [];
  const images = Array.from(
    new Set(safeVariants.flatMap((v) => v.imageUrls ?? [])),
  );

  if (images.length === 0) images.push(FALLBACK_IMAGE);

  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active] ?? FALLBACK_IMAGE}
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
