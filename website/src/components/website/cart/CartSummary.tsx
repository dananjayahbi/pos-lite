"use client";

/**
 * Subtotal row + checkout CTA. Stateless — receives the precomputed
 * totals so it can be reused inside the drawer and the cart page.
 */

import React from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/site';
import { cn } from '@/lib/utils';
import type { CartTotals } from '@/lib/cart';

interface CartSummaryProps {
  tenantSlug: string;
  totals: CartTotals;
  /** "page" shows both checkout CTA + "continue shopping" link,
   *  "drawer" shows only checkout CTA + "view cart" link. */
  variant?: 'drawer' | 'page';
  /** Click on "view cart" / "checkout" — used to close the drawer. */
  onNavigate?: () => void;
}

export function CartSummary({
  tenantSlug,
  totals,
  variant = 'drawer',
  onNavigate,
}: CartSummaryProps) {
  const { itemCount, formattedSubtotal, allInStock } = totals;
  const checkoutHref = ROUTES.checkout(tenantSlug);

  return (
    <div className="border-t border-white/10 pt-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-[#94a3b8]">
          Subtotal{itemCount > 1 ? ` (${itemCount} items)` : ''}
        </span>
        <span className="text-base font-semibold tabular-nums text-white">
          {formattedSubtotal}
        </span>
      </div>

      {!allInStock && (
        <p className="mb-3 rounded bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
          One or more items are now out of stock — please review your cart.
        </p>
      )}

      <Link
        href={checkoutHref}
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className={cn(
          'block w-full rounded-full bg-[#97c93e] py-3 text-center text-sm font-semibold uppercase tracking-wider text-[#051610] transition-all hover:-translate-y-0.5 hover:bg-[#b2db58] hover:shadow-[0_8px_25px_rgba(151,201,62,0.3)]',
        )}
      >
        {variant === 'page' ? 'Place Order' : 'Checkout'}
      </Link>

      {variant === 'drawer' && (
        <Link
          href={checkoutHref}
          {...(onNavigate ? { onClick: onNavigate } : {})}
          className="mt-2 block w-full rounded-full border border-white/15 py-2.5 text-center text-xs uppercase tracking-wider text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white"
        >
          View Cart
        </Link>
      )}
    </div>
  );
}