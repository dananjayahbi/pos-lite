import { describe, expect, it } from 'vitest';

import { resolveOpeningStockQuantity } from '@/lib/services/openingStock.core';

/** ARGUS #139: opening stock is normalised before it becomes a movement. */
describe('resolveOpeningStockQuantity', () => {
  it('uses initialStock from the new-product form', () => {
    expect(resolveOpeningStockQuantity({ initialStock: 3 })).toBe(3);
  });

  it('falls back to stockQuantity when initialStock is absent', () => {
    expect(resolveOpeningStockQuantity({ stockQuantity: 7 })).toBe(7);
  });

  it('prefers initialStock over stockQuantity', () => {
    expect(resolveOpeningStockQuantity({ initialStock: 2, stockQuantity: 9 })).toBe(2);
  });

  it('treats a missing or zero quantity as no opening movement', () => {
    expect(resolveOpeningStockQuantity({})).toBe(0);
    expect(resolveOpeningStockQuantity({ initialStock: 0 })).toBe(0);
  });

  it('never produces a negative or fractional movement', () => {
    expect(resolveOpeningStockQuantity({ initialStock: -5 })).toBe(0);
    expect(resolveOpeningStockQuantity({ initialStock: 4.9 })).toBe(4);
    expect(resolveOpeningStockQuantity({ initialStock: Number.NaN })).toBe(0);
  });
});
