'use client';

import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { CartLineItem } from '@/components/pos/CartLineItem';
import { LineItemDiscountControl } from '@/components/pos/LineItemDiscountControl';

interface CartLineItemsProps {
  /** Empty-state copy; the two layouts word it differently. */
  emptyMessage?: string;
  /** Classes for the list container (e.g. `flex-1 overflow-y-auto`). */
  className?: string;
}

/**
 * The cart's line items, rendered identically wherever the ticket is shown.
 *
 * The classic layout puts this list in the right-hand CartPanel. The keyboard-
 * only console moves it into the page-wide left column (UI update #12), so the
 * same component must not also be mounted in the summary rail — otherwise the
 * cashier sees every line twice.
 */
export function CartLineItems({
  emptyMessage = 'Cart is empty - add a product to start',
  className = '',
}: CartLineItemsProps) {
  const items = useCartStore((s) => s.items);
  const activeLineId = useCartStore((s) => s.activeLineId);

  if (items.length === 0) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center text-mist-ink ${className}`}
      >
        <ShoppingBag className="mb-2 h-10 w-10" aria-hidden="true" />
        <p className="px-4 text-center font-body text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className} data-testid="cart-line-items">
      {items.map((item) => (
        <div key={item.variantId} className="border-b border-mist/30 last:border-b-0">
          <CartLineItem item={item} />
          {activeLineId === item.variantId && <LineItemDiscountControl item={item} />}
        </div>
      ))}
    </div>
  );
}
