'use client';

import Image from 'next/image';
import { Leaf } from 'lucide-react';

interface CategoryIconProps {
  /** Category image URL (or null/empty if none). */
  imageUrl?: string | null;
  /** Category name, used as alt text. */
  name: string;
  /** Size in pixels (square). */
  size?: number;
  className?: string;
}

/**
 * Category image icon. Shows the category image when present, otherwise a
 * neutral leaf placeholder. Used in category lists and the detail panel.
 */
export function CategoryIcon({
  imageUrl,
  name,
  size = 24,
  className,
}: CategoryIconProps) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-md object-cover ${className ?? ''}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-md bg-mist/30 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Leaf className="h-3.5 w-3.5 text-mist" />
    </div>
  );
}
