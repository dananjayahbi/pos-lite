import type { PublicProductVariant } from '@/types/website.types';

/** A single image in the product gallery, with the variants that own it. */
export interface GalleryImage {
  url: string;
  /**
   * Ids of the variants that have this image configured. Empty for a
   * product-level `mainImageUrl` that isn't tied to any single variant.
   */
  variantIds: string[];
}

/**
 * Build the flat, de-duplicated list of gallery images along with the
 * variants that own each one. The product-level main image is kept first
 * (when present); variant images follow. When the same URL belongs to more
 * than one variant, the variant ids are merged so ownership is preserved.
 */
export function buildGalleryImages(
  variants: PublicProductVariant[],
  mainImageUrl?: string | undefined,
): GalleryImage[] {
  const byUrl = new Map<string, string[]>();
  const order: string[] = [];

  const add = (url: string, variantId: string | undefined) => {
    if (!url) return;
    const existing = byUrl.get(url);
    if (!existing) {
      byUrl.set(url, variantId ? [variantId] : []);
      order.push(url);
    } else if (variantId && !existing.includes(variantId)) {
      existing.push(variantId);
    }
  };

  if (mainImageUrl) add(mainImageUrl, undefined);
  for (const v of variants ?? []) {
    for (const url of v.imageUrls ?? []) add(url, v.id);
  }

  return order.map((url) => ({ url, variantIds: byUrl.get(url) ?? [] }));
}

/** The variant that should be auto-selected for a given gallery image index. */
export function variantIdForImage(
  images: GalleryImage[],
  index: number,
): string | undefined {
  return images[index]?.variantIds?.[0];
}

/**
 * Index of the first gallery image owned by the given variant, or -1 when the
 * variant is unset or has no configured images.
 */
export function imageIndexForVariant(
  images: GalleryImage[],
  variantId: string | undefined,
): number {
  if (!variantId) return -1;
  return images.findIndex((img) => img.variantIds.includes(variantId));
}
