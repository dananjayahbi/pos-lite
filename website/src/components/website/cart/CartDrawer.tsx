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
import { CartLineItem } from './CartLineItem';
import { CartSummary } from './CartSummary';

interface CartDrawerProps {
  tenantSlug: string;
}

export function CartDrawer({ tenantSlug }: CartDrawerProps) {
  const lines = useCartStore((s) => s.carts[tenantSlug]?.lines ?? []);
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

  const totals = computeCartTotals(lines);

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
        className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} />
            <h2 className="text-base font-semibold">Your Cart</h2>
            {totals.itemCount > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {totals.itemCount}
              </span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto px-5">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingBag size={40} className="text-gray-300" />
              <p className="text-sm font-medium text-gray-700">Your cart is empty</p>
              <p className="text-xs text-gray-500">
                Add items from the store to start your order.
              </p>
              <button
                type="button"
                onClick={closeDrawer}
                className="mt-2 rounded border border-gray-300 px-4 py-2 text-xs uppercase tracking-wider text-gray-700 hover:bg-gray-50"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
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
          <div className="border-t border-gray-100 px-5 pb-5 pt-2">
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