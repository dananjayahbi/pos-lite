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
  const checkoutHref = ROUTES.cart(tenantSlug);

  return (
    <div className="border-t border-gray-200 bg-white pt-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Subtotal{itemCount > 1 ? ` (${itemCount} items)` : ''}
        </span>
        <span className="text-base font-semibold tabular-nums">
          {formattedSubtotal}
        </span>
      </div>

      {!allInStock && (
        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
          One or more items are now out of stock — please review your cart.
        </p>
      )}

      <Link
        href={checkoutHref}
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className={cn(
          'block w-full rounded bg-black py-3 text-center text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-gray-800',
        )}
      >
        {variant === 'page' ? 'Place Order' : 'Checkout'}
      </Link>

      {variant === 'drawer' && (
        <Link
          href={checkoutHref}
          {...(onNavigate ? { onClick: onNavigate } : {})}
          className="mt-2 block w-full rounded border border-gray-300 py-2.5 text-center text-xs uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-50"
        >
          View Cart
        </Link>
      )}
    </div>
  );
}