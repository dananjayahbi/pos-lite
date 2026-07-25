"use client";

/**
 * Reusable "Add to Cart" button for both the product detail page
 * (full-width primary CTA) and product cards (compact, hover-revealed).
 *
 * Props drive the visual size — the cart logic is identical.
 *
 *   <AddToCartButton variant={selected} product={product} />
 *   <AddToCartButton variant={selected} product={product} size="sm" />
 *
 * Renders nothing if the variant is out of stock (the caller is expected
 * to disable this button — the component itself hides on zero stock so
 * a quick re-mount in a different context doesn't accidentally add it).
 */

import React from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { cn } from '@/lib/utils';
import type { PublicProductVariant } from '@/types/website.types';

interface AddToCartButtonProps {
  tenantSlug: string;
  variant: PublicProductVariant | undefined;
  product: { id: string; name: string };
  quantity?: number;
  /** Full-width hero CTA vs. compact card CTA. */
  size?: 'sm' | 'md' | 'lg';
  /** Hide the icon (useful inside cards where space is tight). */
  hideIcon?: boolean;
  /** Optional className to override or extend layout styles. */
  className?: string;
  /** Render as the inline card style (no border on hover). */
  variantStyle?: 'solid' | 'outline';
  /** Optional click override — fired after the cart store update. */
  onAfterAdd?: () => void;
}

export function AddToCartButton({
  tenantSlug,
  variant,
  product,
  quantity = 1,
  size = 'lg',
  hideIcon = false,
  className,
  variantStyle = 'solid',
  onAfterAdd,
}: AddToCartButtonProps) {
  const addItem = useCartStore((s) => s.addItem);
  const alreadyInCart = useCartStore((s) =>
    variant ? s.carts[tenantSlug]?.lines.some((l) => l.variantId === variant.id) : false,
  );

  if (!variant || variant.stockQuantity <= 0) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={cn(
          'w-full cursor-not-allowed rounded bg-gray-200 py-3 text-sm font-medium uppercase tracking-wider text-gray-500 sm:w-auto sm:px-12',
          className,
        )}
      >
        Out of stock
      </button>
    );
  }

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    // When rendered inside a Link card, prevent the surrounding <a>
    // from following its href so the navigation doesn't happen.
    e.preventDefault();
    e.stopPropagation();
    addItem(tenantSlug, variant, product, quantity);
    onAfterAdd?.();
  };

  const sizeClasses =
    size === 'lg'
      ? 'py-3 px-6 text-sm sm:px-12'
      : size === 'md'
        ? 'py-2 px-4 text-xs'
        : 'py-1.5 px-3 text-[11px]';

  const styleClasses =
    variantStyle === 'solid'
      ? 'border border-black bg-black text-white hover:bg-gray-800'
      : 'border border-black text-black bg-transparent hover:bg-black hover:text-white';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-medium uppercase tracking-wider transition-colors',
        sizeClasses,
        styleClasses,
        alreadyInCart && 'border-green-700 bg-green-700 hover:bg-green-800',
        className,
      )}
      aria-label={`Add ${variant.sku} to cart`}
    >
      {!hideIcon &&
        (alreadyInCart ? <Check size={size === 'lg' ? 16 : 12} /> : <ShoppingCart size={size === 'lg' ? 16 : 12} />)}
      <span>{alreadyInCart ? 'In Cart' : 'Add to Cart'}</span>
    </button>
  );
}