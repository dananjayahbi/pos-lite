'use client';

import { clearAllCartSnapshots } from '@/lib/idb-store';
import { useCartStore } from '@/stores/cartStore';

/**
 * ARGUS #66 — clear the terminal cart on explicit sign-out.
 *
 * The in-memory zustand cart is cleared immediately (no flash of the previous
 * cashier's items) and every cached cart snapshot is deleted from IndexedDB, so
 * the next user cannot inherit it even if a scoped key is reused. Never blocks
 * the sign-out itself.
 */
export async function clearCartOnSignOut(): Promise<void> {
  try {
    useCartStore.getState().clearCart();
  } catch {
    // The store may already be gone during a hard navigation; the IDB clear
    // below is still worth attempting.
  }
  try {
    await clearAllCartSnapshots();
  } catch {
    // Sign-out must never fail because IndexedDB is unavailable.
  }
}
