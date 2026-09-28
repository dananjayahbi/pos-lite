"use client";

/**
 * Slide-in side panel that lists the current tenant's cart lines.
 *
 * Visibility is driven by `useCartStore.drawerTenant` — open it via
 * `openDrawer(slug)` and close with `closeDrawer()`. Mount this
 * component ONCE near the root of your tree (see CartDrawerHost).
 *
 * Keyboard: `Esc` closes the drawer; focus is trapped while open.
 */

import React, { useEffect, useRef } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { computeCartTotals } from '@/lib/cart';
import type { CartLine } from '@/stores/cartStore';
import { CartLineItem } from './CartLineItem';
import { CartSummary } from './CartSummary';

interface CartDrawerProps {
  tenantSlug: string;
}

// Stable reference used when the tenant has no cart yet, so the
// selector returns the same identity every render and React's
// `useSyncExternalStore` does not loop.
const EMPTY_LINES: ReadonlyArray<never> = Object.freeze([]) as ReadonlyArray<never>;

export function CartDrawer({ tenantSlug }: CartDrawerProps) {
  // Select the raw `lines` array (or undefined) so the selector returns a
  // stable reference. Returning a fresh `[]` on every call would defeat
  // the snapshot caching in `useSyncExternalStore` and trigger the
  // "getServerSnapshot should be cached" infinite-loop error.
  const lines = useCartStore((s) => s.carts[tenantSlug]?.lines ?? EMPTY_LINES);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const isOpen = useCartStore((s) => s.drawerTenant === tenantSlug);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll + close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);

    // Focus the close button so screen readers announce the dialog.
    closeBtnRef.current?.focus();

    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, closeDrawer]);

  if (!isOpen) return null;

  const totals = computeCartTotals(lines as CartLine[]);

  return (
    <div
      className="fixed inset-0 z-[60] flex"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeDrawer}
        className="flex-1 bg-black/40 backdrop-blur-[1px] transition-opacity"
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        className="relative ml-auto flex h-full w-full max-w-md flex-col bg-[#082017] text-[#cbd5e1] shadow-2xl animate-in slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#97c93e]" />
            <h2 className="text-base font-semibold text-white">Your Cart</h2>
            {totals.itemCount > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[#cbd5e1]">
                {totals.itemCount}
              </span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            className="rounded p-1.5 text-[#94a3b8] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto px-5">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingBag size={40} className="text-[#64748b]" />
              <p className="text-sm font-medium text-white">Your cart is empty</p>
              <p className="text-xs text-[#94a3b8]">
                Add items from the store to start your order.
              </p>
              <button
                type="button"
                onClick={closeDrawer}
                className="mt-2 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-wider text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-3">
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
                  onNavigate={closeDrawer}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && (
          <div className="border-t border-white/10 px-5 pb-5 pt-2">
            <CartSummary
              tenantSlug={tenantSlug}
              totals={totals}
              variant="drawer"
              onNavigate={closeDrawer}
            />
          </div>
        )}
      </div>
    </div>
  );
}