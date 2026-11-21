import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import {
  assertPackagingItemDeletable,
  packagingUpdateTouchesStock,
} from '@/lib/services/packagingGuards.core';

/** ARGUS #280: stock edits go through Adjust, and delete cannot hide stock. */
function apiErrorOf(run: () => void): ApiError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the guard to throw');
}

describe('packagingUpdateTouchesStock', () => {
  it('detects a direct quantity write even when the value is zero', () => {
    expect(packagingUpdateTouchesStock({ quantityOnHand: 0 })).toBe(true);
    expect(packagingUpdateTouchesStock({ quantityOnHand: 42 })).toBe(true);
    expect(packagingUpdateTouchesStock({ quantityOnHand: null })).toBe(true);
    expect(packagingUpdateTouchesStock({ quantityOnHand: undefined })).toBe(true);
  });

  it('allows edits that do not carry stock', () => {
    expect(packagingUpdateTouchesStock({ name: 'Tape' })).toBe(false);
    expect(packagingUpdateTouchesStock({ lowStockThreshold: 5, autoDeduct: true })).toBe(false);
    expect(packagingUpdateTouchesStock(null)).toBe(false);
    expect(packagingUpdateTouchesStock('quantityOnHand')).toBe(false);
  });
});

describe('assertPackagingItemDeletable', () => {
  it('allows deleting an empty item', () => {
    expect(() => assertPackagingItemDeletable({ quantityOnHand: 0 })).not.toThrow();
  });

  it('blocks deletion while stock remains and names the count/unit', () => {
    const error = apiErrorOf(() =>
      assertPackagingItemDeletable({ quantityOnHand: 10, unit: 'METER' }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('PACKAGING_HAS_STOCK');
    expect(error.message).toContain('10 m');
    expect(error.message).toMatch(/adjust the stock to zero/i);
  });

  it('formats fractional quantities without trailing zeros', () => {
    const error = apiErrorOf(() =>
      assertPackagingItemDeletable({ quantityOnHand: 2.5, unit: 'METER' }),
    );
    expect(error.message).toContain('2.5 m');
  });

  it('treats a non-positive (corrupt) quantity as nothing to write off', () => {
    expect(() => assertPackagingItemDeletable({ quantityOnHand: -1 })).not.toThrow();
  });
});
