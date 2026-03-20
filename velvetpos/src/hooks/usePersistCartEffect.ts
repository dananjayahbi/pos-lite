'use client';

import { useEffect } from 'react';
import { saveCartSnapshot, loadCartSnapshot, clearCartSnapshot } from '@/lib/idb-store';
import { useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/stores/cartStore';

const CART_STORE_KEY = 'velvetpos_cart_default';

interface PersistedCartState {
  items: CartItem[];
  cartDiscountPercent: number;
  cartDiscountAmount: number;
}

export function usePersistCartEffect(cartState: PersistedCartState): void {
  // Save cart whenever it changes
  useEffect(() => {
    (async () => {
      try {
        if (cartState.items.length === 0) {
          await clearCartSnapshot(CART_STORE_KEY);
        } else {
          await saveCartSnapshot(CART_STORE_KEY, cartState);
        }
      } catch (err) {
        console.warn('[usePersistCartEffect] Failed to save cart:', err);
      }
    })();
  }, [cartState]);

  // Restore cart on mount
  useEffect(() => {
    (async () => {
      try {
        const snapshot = await loadCartSnapshot(CART_STORE_KEY);
        if (snapshot) {
          const data = snapshot as PersistedCartState;
          if (data.items && data.items.length > 0) {
            useCartStore.getState().replaceCart(
              data.items,
              data.cartDiscountPercent ?? 0,
              data.cartDiscountAmount ?? 0,
            );
          }
        }
      } catch (err) {
        console.warn('[usePersistCartEffect] Failed to restore cart:', err);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
