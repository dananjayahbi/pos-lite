import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POS_LOW_STOCK_THRESHOLD,
  isLowStockVariant,
  productCardStockState,
} from '@/components/pos/productStockState';

describe('POS product card stock state (ARGUS #73)', () => {
  it('shows low when a single variant is at or below its own threshold', () => {
    // 500 ml has 5 units with a threshold of 5; the other variants keep the
    // product total well above 5.
    const state = productCardStockState([
      { stockQuantity: 5, lowStockThreshold: 5 },
      { stockQuantity: 40, lowStockThreshold: 5 },
      { stockQuantity: 12, lowStockThreshold: 5 },
    ]);

    expect(state.totalStock).toBe(57);
    expect(state.outOfStock).toBe(false);
    expect(state.lowStockVariantCount).toBe(1);
    expect(state.hasLowStockVariant).toBe(true);
  });

  it('does not flag a variant above its threshold', () => {
    expect(
      productCardStockState([
        { stockQuantity: 8, lowStockThreshold: 5 },
        { stockQuantity: 30, lowStockThreshold: 5 },
      ]).hasLowStockVariant,
    ).toBe(false);
  });

  it('counts every low variant, and empty stock is out of stock not low', () => {
    const state = productCardStockState([
      { stockQuantity: 0, lowStockThreshold: 5 },
      { stockQuantity: 2, lowStockThreshold: 5 },
      { stockQuantity: 5, lowStockThreshold: 5 },
    ]);

    expect(state.lowStockVariantCount).toBe(2);
    expect(state.hasLowStockVariant).toBe(true);
    expect(state.outOfStock).toBe(false);
    expect(productCardStockState([{ stockQuantity: 0 }])).toMatchObject({
      totalStock: 0,
      outOfStock: true,
      hasLowStockVariant: false,
    });
  });

  it('falls back to the default threshold for legacy variants without one', () => {
    expect(DEFAULT_POS_LOW_STOCK_THRESHOLD).toBe(5);
    expect(isLowStockVariant({ stockQuantity: 5 })).toBe(true);
    expect(isLowStockVariant({ stockQuantity: 6 })).toBe(false);
    expect(isLowStockVariant({ stockQuantity: 3, lowStockThreshold: 2 })).toBe(false);
  });
});
