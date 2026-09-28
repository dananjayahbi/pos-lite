'use client';

import React from 'react';
import type { PublicProductVariant } from '@/types/website.types';
import {
  buildGalleryImages,
  type GalleryImage,
} from '@/components/website/product-detail/galleryImages';
import { useImageSwipe } from '@/components/website/product-detail/useImageSwipe';

interface ProductGalleryProps {
  variants: PublicProductVariant[];
  productName: string;
  /** Product-level main image, shown first when present. */
  mainImageUrl?: string | undefined;
  /** Controlled active image index (lifted to the parent for cross-sync). */
  activeIndex?: number;
  /** Called when the visitor changes the active image through the UI. */
  onImageChange?: (index: number) => void;
}

/**
 * Image gallery with thumbnail strip. Collects all unique image URLs across
 * every variant and lets the visitor browse them. The active index is
 * controlled by the parent so the variant selector can stay in sync.
 */
export function ProductGallery({
  variants,
  productName,
  mainImageUrl,
  activeIndex = 0,
  onImageChange,
}: ProductGalleryProps) {
  const images: GalleryImage[] = buildGalleryImages(variants ?? [], mainImageUrl);
  const safeCount = images.length;
  const current = Math.min(Math.max(activeIndex, 0), Math.max(safeCount - 1, 0));

  const setActive = (index: number) => {
    if (!onImageChange) return;
    const clamped = Math.min(Math.max(index, 0), Math.max(safeCount - 1, 0));
    onImageChange(clamped);
  };

  const { onTouchStart, onTouchEnd } = useImageSwipe({
    onPrev: () => setActive(current - 1),
    onNext: () => setActive(current + 1),
  });

  const currentImage = images[current];

  if (!currentImage) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-[#082017] text-sm text-[#64748b]">
        Image unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image — object-contain so non-square images aren't cropped */}
      <div
        className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-[#082017]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage.url}
          alt={productName}
          className="h-full w-full select-none object-contain"
          draggable={false}
        />
      </div>

      {/* Navigation arrows */}
      {safeCount > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => setActive(current - 1)}
            disabled={current === 0}
            className="rounded-lg border border-white/10 bg-[#082017] px-3 py-1.5 text-sm text-[#cbd5e1] transition-colors hover:border-[#97c93e]/50 hover:text-white disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-[#cbd5e1]"
          >
            ←
          </button>
          <span className="text-xs text-[#94a3b8]">
            {current + 1} / {safeCount}
          </span>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => setActive(current + 1)}
            disabled={current === safeCount - 1}
            className="rounded-lg border border-white/10 bg-[#082017] px-3 py-1.5 text-sm text-[#cbd5e1] transition-colors hover:border-[#97c93e]/50 hover:text-white disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-[#cbd5e1]"
          >
            →
          </button>
        </div>
      )}

      {/* Thumbnails */}
      {safeCount > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === current ? 'border-[#97c93e]' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`${productName} thumbnail ${i + 1}`}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
