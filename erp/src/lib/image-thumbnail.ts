/**
 * Server-side image thumbnail generation (Feature update #14).
 *
 * Every uploaded product image is stored twice:
 *  - the full-size original (`imageUrls` / `mainImageUrl`), used by the
 *    storefront where large imagery matters;
 *  - a 256×256 WebP thumbnail (`thumbnailImageUrls` /
 *    `mainImageThumbnailUrl`), used by icon-size surfaces such as the POS
 *    product grid, inventory rows and pickers.
 *
 * Keeping the thumbnail square/cropped lets every consumer use one fixed size
 * without layout shifts, and WebP at quality 72 is a fraction of the original.
 */
import sharp from 'sharp';

/** Edge length of every generated thumbnail, in pixels. */
export const THUMBNAIL_EDGE = 256;

/** WebP quality for thumbnails: visually fine at 2× POS tile size. */
export const THUMBNAIL_QUALITY = 72;

export async function createThumbnail(
  input: Buffer,
  edge: number = THUMBNAIL_EDGE,
): Promise<Buffer> {
  return sharp(input)
    // Honour EXIF orientation before cropping.
    .rotate()
    .resize(edge, edge, { fit: 'cover', position: 'centre' })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();
}

/**
 * Picks the thumbnail when present, otherwise the full-size image. Consumer
 * components use this so old rows without a generated thumbnail still render.
 */
export function resolveDisplayImage(
  fullUrl: string | null | undefined,
  thumbnailUrl: string | null | undefined,
): string | null {
  return thumbnailUrl ?? fullUrl ?? null;
}
