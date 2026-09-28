'use client';

import React from 'react';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';
import { CartIcon } from '@/components/website/cart/CartIcon';
import { CartDrawerHost } from '@/components/website/cart/CartDrawerHost';

interface StoreHeaderProps {
  tenantSlug: string;
  /** Store display name; falls back to a neutral label when absent. */
  storeName?: string | undefined;
  /** Optional label for the "back to store" link. */
  backLabel?: string;
}

/**
 * Common, slim top bar shared by the inner storefront pages (product,
 * category, cart, checkout, track). Renders the store brand on the left, a
 * back-to-store link and a cart button on the right, plus the cart drawer
 * host. Keeps each page's shell consistent without duplicating header code.
 */
export function StoreHeader({
  tenantSlug,
  storeName,
  backLabel = 'Back to store',
}: StoreHeaderProps) {
  return (
    <header className="border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        <Link
          href={tenantHomePath(tenantSlug)}
          className="text-lg font-medium text-white"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          {storeName || 'Store'}
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-sm text-[#94a3b8] hover:text-[#97c93e] transition-colors"
          >
            ← {backLabel}
          </Link>
          <CartIcon tenantSlug={tenantSlug} className="text-white hover:text-[#97c93e]" />
        </div>
      </div>

      {/* Cart drawer + host so the cart opens over any page */}
      <CartDrawerHost tenantSlug={tenantSlug} />
    </header>
  );
}
