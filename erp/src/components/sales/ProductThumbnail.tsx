import Image from 'next/image';
import { ShoppingBag } from 'lucide-react';

interface ProductThumbnailProps {
  /** Resolved image URL, if any. Callers decide product-vs-variant precedence. */
  src: string | null | undefined;
  alt: string;
  /** Rendered square size in pixels. Defaults to 40. */
  size?: number;
  className?: string;
}

/**
 * Small square product image for list rows and search results.
 *
 * Falls back to a ShoppingBag icon so rows keep a consistent height whether or
 * not a product has been photographed yet.
 */
export function ProductThumbnail({ src, alt, size = 40, className }: ProductThumbnailProps) {
  const style = { width: size, height: size };

  return (
    <div
      style={style}
      className={`bg-linen relative shrink-0 overflow-hidden rounded-md${className ? ` ${className}` : ''}`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ShoppingBag
            className="text-terracotta/60"
            style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Picks the image to show for a product/variant pair.
 *
 * Product-level imagery wins because the POS grid treats it as canonical;
 * variant images are the fallback for products photographed per pack size.
 */
export function resolveProductImage(
  mainImageUrl: string | null | undefined,
  variantImageUrls?: string[] | null,
): string | null {
  if (mainImageUrl) return mainImageUrl;
  const first = (variantImageUrls ?? []).find((u) => !!u);
  return first ?? null;
}
