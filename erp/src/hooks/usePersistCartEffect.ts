'use client';

import { useEffect, useState } from 'react';
import { saveCartSnapshot, loadCartSnapshot, clearCartSnapshot } from '@/lib/idb-store';
import { useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/stores/cartStore';
import { createCartPromotionSnapshot } from '@/stores/cartPromotions';
import type { CartPromotionSnapshot } from '@/stores/cartPromotions';

const CART_STORE_KEY = 'ayurpos_cart_default';

interface PersistedCartState {
  items: CartItem[];
  cartDiscountPercent: number;
  cartDiscountAmount: number;
  promotions?: CartPromotionSnapshot;
  /**
   * Credit from an EXCHANGE return. Persisted even when the cart is empty so a
   * reload between processing the return and building the replacement sale
   * does not lose the customer's value.
   */
  exchange?: {
    returnId: string;
    credit: number;
    ref: string;
  } | null;
}

export function usePersistCartEffect(cartState: PersistedCartState): void {
  const [hydrated, setHydrated] = useState(false);

  // Restore first. On a fresh mount the store is empty, so persisting before
  // this runs would delete the snapshot we are about to read — which is why a
  // reload used to come back to an empty cart.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await loadCartSnapshot(CART_STORE_KEY);
        if (!cancelled && snapshot) {
          const data = snapshot as PersistedCartState;
          const hasItems = Array.isArray(data.items) && data.items.length > 0;
          if (hasItems || data.exchange) {
            useCartStore.getState().restoreCartWithPromotions({
              items: hasItems ? data.items : [],
              cartDiscountPercent: data.cartDiscountPercent ?? 0,
              cartDiscountAmount: data.cartDiscountAmount ?? 0,
              promotions: createCartPromotionSnapshot(data.promotions),
              exchange: data.exchange ?? null,
            });
          }
        }
      } catch (err) {
        console.warn('[usePersistCartEffect] Failed to restore cart:', err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist only after the restore attempt has settled, so the stored snapshot
  // is never cleared before it has been read back.
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        if (cartState.items.length === 0 && !cartState.exchange) {
          await clearCartSnapshot(CART_STORE_KEY);
        } else {
          await saveCartSnapshot(CART_STORE_KEY, {
            items: cartState.items,
            cartDiscountPercent: cartState.cartDiscountPercent,
            cartDiscountAmount: cartState.cartDiscountAmount,
            promotions: createCartPromotionSnapshot(cartState.promotions),
            exchange: cartState.exchange ?? null,
          });
        }
      } catch (err) {
        console.warn('[usePersistCartEffect] Failed to save cart:', err);
      }
    })();
  }, [hydrated, cartState]);
}
