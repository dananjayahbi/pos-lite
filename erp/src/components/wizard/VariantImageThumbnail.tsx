'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, X, ImageOff, Loader2 } from 'lucide-react';

interface VariantImageThumbnailProps {
  /** Source URL (object URL or remote). */
  src: string;
  /** Alt text for accessibility. */
  alt: string;
  /** Whether this thumbnail is the primary image for the variant. */
  isPrimary: boolean;
  /** Shows a spinner instead of the image (used during sequential staging). */
  isLoading?: boolean;
  /** Handler to mark this thumbnail as primary. Omit to hide the star button. */
  onSetPrimary?: (() => void) | undefined;
  /** Handler to remove this thumbnail. Omit to hide the remove button. */
  onRemove?: (() => void) | undefined;
}

/**
 * Single 64×64 image tile for a variant image grid.
 *
 * - Primary star (top-left) is rendered only when `onSetPrimary` is provided.
 * - Remove button (top-right) is revealed on hover; rendered only when
 *   `onRemove` is provided.
 * - Loading state shows a spinner (used while files are being staged
 *   one-by-one in the parent).
 * - A broken preview (e.g. revoked object URL) automatically falls back to
 *   an ImageOff icon.
 */
export function VariantImageThumbnail({
  src,
  alt,
  isPrimary,
  isLoading = false,
  onSetPrimary,
  onRemove,
}: VariantImageThumbnailProps) {
  const [isBroken, setIsBroken] = useState(false);

  return (
    <div
      className={`group relative h-16 w-16 shrink-0 overflow-hidden rounded border bg-linen ${
        isPrimary
          ? 'border-terracotta ring-1 ring-terracotta'
          : 'border-sand/40'
      }`}
    >
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-terracotta" />
        </div>
      ) : isBroken ? (
        <div className="flex h-full w-full flex-col items-center justify-center">
          <ImageOff className="h-3.5 w-3.5 text-mist" />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-cover"
          onError={() => setIsBroken(true)}
        />
      )}

      {onSetPrimary && (
        <button
          type="button"
          onClick={onSetPrimary}
          title={isPrimary ? 'Primary image' : 'Set as primary'}
          aria-label={isPrimary ? 'Primary image' : 'Set as primary image'}
          className="absolute top-0.5 left-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-pearl/90"
        >
          <Star
            className={`h-3 w-3 ${
              isPrimary
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-mist'
            }`}
          />
        </button>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove image"
          className="absolute top-0.5 right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#9B2226]/80 text-pearl opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}