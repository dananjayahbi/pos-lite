'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { saveCartSnapshot, loadCartSnapshot, clearCartSnapshot } from '@/lib/idb-store';
import { useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/stores/cartStore';
import { createCartPromotionSnapshot } from '@/stores/cartPromotions';
import type { CartPromotionSnapshot } from '@/stores/cartPromotions';
import {
  LEGACY_CART_STORE_KEY,
  buildCartStoreKey,
  type CartOwner,
} from '@/lib/pos/cartPersistence';
import { clearCartOnSignOut } from '@/lib/pos/cartSession';

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

/**
 * Persist/restore the active cart for one cashier + shift (ARGUS #66).
 *
 * The old snapshot key was terminal-wide, so a prior cashier's cart came back
 * after logout. The key is now `<prefix>_<userId>_<shiftId>`; the legacy shared
 * key is deleted and never read. Missing ownership during session hydration
 * disables persistence rather than falling back to a shared bucket.
 */
export function usePersistCartEffect(cartState: PersistedCartState, owner: CartOwner): void {
  // The key whose snapshot has finished loading. Persistence stays off until
  // this equals the current scoped key, so a new owner's snapshot cannot be
  // overwritten by the previous cart.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const { status } = useSession();
  const storeKey = buildCartStoreKey(owner);

  // Session expiry (or a client-side logout that did not hit a sign-out button)
  // must not leave the previous cashier's cart available to the next user.
  useEffect(() => {
    if (status === 'unauthenticated') {
      void clearCartOnSignOut();
    }
  }, [status]);

  // Restore first. On a fresh mount the store is empty, so persisting before
  // this runs would delete the snapshot we are about to read. The effect reruns
  // when the session/shift resolves the scoped key.
  useEffect(() => {
    // The old terminal-wide key can only leak a cart across owners.
    void clearCartSnapshot(LEGACY_CART_STORE_KEY).catch(() => {});

    if (!storeKey) return;

    let cancelled = false;
    (async () => {
      try {
        const snapshot = await loadCartSnapshot(storeKey);
        // Do not overwrite a cart the cashier already started while the
        // session/key was still hydrating.
        if (
          !cancelled &&
          snapshot &&
          useCartStore.getState().items.length === 0
        ) {
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
        if (!cancelled) setHydratedKey(storeKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeKey]);

  // Persist only after the restore attempt has settled for this owner.
  useEffect(() => {
    if (!storeKey || hydratedKey !== storeKey) return;
    (async () => {
      try {
        if (cartState.items.length === 0 && !cartState.exchange) {
          await clearCartSnapshot(storeKey);
        } else {
          await saveCartSnapshot(storeKey, {
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
  }, [hydratedKey, storeKey, cartState]);
}
