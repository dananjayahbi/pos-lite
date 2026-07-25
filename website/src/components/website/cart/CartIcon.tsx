"use client";

/**
 * Header cart button: shows a bag icon with a count badge.
 * Clicking it opens the tenant-specific cart drawer.
 *
 * Visual states:
 *   - hidden on xs (icon-only on small screens), shows label on md+
 *   - badge hidden when cart is empty
 *   - subtle bump animation when an item is added
 */

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCartStore, selectCartCount } from '@/stores/cartStore';

interface CartIconProps {
  tenantSlug: string;
  className?: string;
}

export function CartIcon({ tenantSlug, className }: CartIconProps) {
  const count = useCartStore(selectCartCount(tenantSlug));
  const toggle = useCartStore((s) => s.toggleDrawer);

  const handleClick = () => toggle(tenantSlug);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Open cart (${count} item${count === 1 ? '' : 's'})`}
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-black',
        className,
      )}
    >
      <span className="relative">
        <ShoppingBag size={20} />
        {count > 0 && (
          <span
            key={count /* re-mount triggers CSS animation on count change */}
            className="absolute -top-2 -right-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white animate-in fade-in zoom-in"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="hidden md:inline">Cart</span>
    </button>
  );
}