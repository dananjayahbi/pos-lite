'use client';

import React, { useState } from 'react';
import type { PublicProduct, PublicProductVariant } from '@/types/website.types';
import { ProductGallery } from '@/components/website/product-detail/ProductGallery';
import { ProductInfo } from '@/components/website/product-detail/ProductInfo';
import {
  buildGalleryImages,
  imageIndexForVariant,
  variantIdForImage,
} from '@/components/website/product-detail/galleryImages';

interface ProductDetailProps {
  product: PublicProduct;
  tenantSlug: string;
}

/**
 * Client wrapper that keeps the gallery and the variant selector in sync.
 *
 * - Selecting a variant moves the gallery to that variant's first image.
 * - Swiping/clicking through the gallery auto-selects the variant that owns
 *   the current image.
 *
 * The active variant is the single source of truth; the active image index is
 * derived from it whenever the variant changes, and updated independently
 * when the visitor browses images directly.
 */
export function ProductDetail({ product, tenantSlug }: ProductDetailProps) {
  const variants = product.variants ?? [];
  const images = buildGalleryImages(variants, product.mainImageUrl);

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    product.primaryVariant?.id ?? variants[0]?.id,
  );

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(imageIndexForVariant(images, selectedVariantId), 0),
  );

  // Selecting a variant moves the gallery to that variant's first image.
  const handleVariantChange = (variant: PublicProductVariant | undefined) => {
    if (!variant) return;
    setSelectedVariantId(variant.id);
    const idx = imageIndexForVariant(images, variant.id);
    if (idx >= 0) setActiveIndex(idx);
  };

  // When the visitor browses images directly, auto-select the variant that
  // owns the current image (when one is configured for it).
  const handleImageChange = (index: number) => {
    setActiveIndex(index);
    const variantId = variantIdForImage(images, index);
    if (variantId) setSelectedVariantId(variantId);
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ProductGallery
        variants={variants}
        productName={product.name}
        mainImageUrl={product.mainImageUrl}
        activeIndex={activeIndex}
        onImageChange={handleImageChange}
      />
      <ProductInfo
        product={product}
        tenantSlug={tenantSlug}
        selectedVariantId={selectedVariantId}
        onVariantChange={handleVariantChange}
      />
    </div>
  );
}
