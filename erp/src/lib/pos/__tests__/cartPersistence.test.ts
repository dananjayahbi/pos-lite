import { describe, expect, it } from 'vitest';

import {
  LEGACY_CART_STORE_KEY,
  buildCartStoreKey,
  isCartStoreKeyForShift,
  isLegacyCartStoreKey,
} from '@/lib/pos/cartPersistence';

/** ARGUS #66 — a cart must never be restored for another user/shift. */
describe('buildCartStoreKey', () => {
  it('scopes the snapshot by cashier and shift', () => {
    expect(buildCartStoreKey({ userId: 'user-1', shiftId: 'shift-1' })).toBe(
      'ayurpos_cart_user-1_shift-1',
    );
    expect(buildCartStoreKey({ userId: 'user-2', shiftId: 'shift-1' })).not.toBe(
      buildCartStoreKey({ userId: 'user-1', shiftId: 'shift-1' }),
    );
    expect(buildCartStoreKey({ userId: 'user-1', shiftId: 'shift-2' })).not.toBe(
      buildCartStoreKey({ userId: 'user-1', shiftId: 'shift-1' }),
    );
  });

  it('is stable for the same owner', () => {
    expect(buildCartStoreKey({ userId: 'u', shiftId: 's' })).toBe(
      buildCartStoreKey({ userId: 'u', shiftId: 's' }),
    );
  });

  it('refuses to produce a shared fallback while ownership is unknown', () => {
    expect(buildCartStoreKey({ userId: null, shiftId: 'shift-1' })).toBeNull();
    expect(buildCartStoreKey({ userId: 'user-1', shiftId: null })).toBeNull();
    expect(buildCartStoreKey({ userId: undefined, shiftId: undefined })).toBeNull();
  });
});

describe('isCartStoreKeyForShift', () => {
  it('matches only the requested shift', () => {
    expect(isCartStoreKeyForShift('ayurpos_cart_u1_s1', 's1')).toBe(true);
    expect(isCartStoreKeyForShift('ayurpos_cart_u2_s1', 's1')).toBe(true);
    expect(isCartStoreKeyForShift('ayurpos_cart_u1_s2', 's1')).toBe(false);
    expect(isCartStoreKeyForShift(LEGACY_CART_STORE_KEY, 's1')).toBe(false);
  });

  it('rejects a missing shift', () => {
    expect(isCartStoreKeyForShift('ayurpos_cart_u1_s1', null)).toBe(false);
  });
});

describe('isLegacyCartStoreKey', () => {
  it('recognizes the old terminal-wide key', () => {
    expect(isLegacyCartStoreKey(LEGACY_CART_STORE_KEY)).toBe(true);
    expect(isLegacyCartStoreKey('ayurpos_cart_default')).toBe(true);
  });

  it('does not mistake a new scoped key for a legacy one', () => {
    expect(isLegacyCartStoreKey('ayurpos_cart_user-1_shift-1')).toBe(false);
    expect(isLegacyCartStoreKey('other-store')).toBe(false);
  });
});
