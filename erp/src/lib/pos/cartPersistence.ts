/**
 * ARGUS #66 — cart persistence ownership.
 *
 * The IndexedDB snapshot used one terminal-wide key, so a cart left by one
 * cashier was restored for the next user/shift after logout. The key now
 * includes the cashier and the open shift; missing ownership means "do not
 * restore or persist" rather than falling back to the shared key. The legacy
 * unscoped key is never read and is deleted on first use.
 */

export const CART_SNAPSHOT_PREFIX = 'ayurpos_cart';
export const LEGACY_CART_STORE_KEY = 'ayurpos_cart_default';

export interface CartOwner {
  userId: string | null | undefined;
  shiftId: string | null | undefined;
}

/** Stable scoped key, or null when the owner is not fully known yet. */
export function buildCartStoreKey(owner: CartOwner): string | null {
  if (!owner.userId || !owner.shiftId) return null;
  return `${CART_SNAPSHOT_PREFIX}_${owner.userId}_${owner.shiftId}`;
}

/** True when a stored key belongs to the given shift (used on shift close). */
export function isCartStoreKeyForShift(
  key: string,
  shiftId: string | null | undefined,
): boolean {
  if (!shiftId || !key.startsWith(`${CART_SNAPSHOT_PREFIX}_`)) return false;
  return key.endsWith(`_${shiftId}`);
}

/** True for the old terminal-wide key (or any pre-scope key). */
export function isLegacyCartStoreKey(key: string): boolean {
  if (key === LEGACY_CART_STORE_KEY) return true;
  if (!key.startsWith(`${CART_SNAPSHOT_PREFIX}_`)) return false;
  const rest = key.slice(CART_SNAPSHOT_PREFIX.length + 1);
  return !rest.includes('_');
}
