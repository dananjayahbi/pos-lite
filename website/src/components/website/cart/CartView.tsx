"use client";

/**
 * Full-page cart view at `/[tenantSlug]/cart`.
 *
 * Renders the same lines + summary that the drawer does, but in a
 * standalone layout. The drawer is still available via the header
 * cart icon; this page is for users who closed the drawer and want
 * to review or check out.
 */

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/site';
import { useCartStore } from '@/stores/cartStore';
import { computeCartTotals } from '@/lib/cart';
import { CartLineItem } from '@/components/website/cart/CartLineItem';
import { CartSummary } from '@/components/website/cart/CartSummary';

interface CartViewProps {
  tenantSlug: string;
}

export function CartView({ tenantSlug }: CartViewProps) {
  const lines = useCartStore((s) => s.carts[tenantSlug]?.lines ?? []);

  const totals = computeCartTotals(lines);

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 py-20 text-center">
        <ShoppingBag size={56} className="text-gray-300" />
        <h1
          className="text-2xl font-medium"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          Your cart is empty
        </h1>
        <p className="text-sm text-gray-500">
          Browse our shop and add items to start an order.
        </p>
        <Link
          href={ROUTES.shop(tenantSlug)}
          className="mt-2 inline-flex items-center gap-2 rounded bg-black px-6 py-3 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft size={14} /> Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_360px]">
      {/* Lines */}
      <section>
        <h1
          className="mb-4 text-2xl font-medium"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          Your Cart ({totals.itemCount})
        </h1>
        <div className="rounded-lg border border-gray-200 bg-white px-4">
          {lines.map((line) => (
            <CartLineItem
              key={line.variantId}
              tenantSlug={tenantSlug}
              variantId={line.variantId}
              productId={line.productId}
              productName={line.productName}
              variantSku={line.variantSku}
              image={line.image}
              price={line.price}
              quantity={line.quantity}
              maxStock={line.maxStock}
            />
          ))}
        </div>
        <Link
          href={ROUTES.shop(tenantSlug)}
          className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-wider text-gray-600 hover:text-black"
        >
          <ArrowLeft size={12} /> Continue Shopping
        </Link>
      </section>

      {/* Summary */}
      <aside className="md:sticky md:top-6 md:self-start">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <CartSummary tenantSlug={tenantSlug} totals={totals} variant="page" />
          <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
            Checkout is coming soon. For now, contact the store to finalize your
            order.
          </p>
        </div>
      </aside>
    </div>
  );
}