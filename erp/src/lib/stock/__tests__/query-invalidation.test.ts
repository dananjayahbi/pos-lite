import { describe, expect, it } from 'vitest';

import {
  STOCK_ADJUSTMENT_QUERY_ROOTS,
  stockAdjustmentQueryKeys,
} from '@/lib/stock/query-invalidation';

/**
 * ARGUS #194 - a stock adjustment must invalidate every screen that caches a
 * stock figure. Missing one leaves stale numbers for 30 s - 5 min.
 */
describe('stock adjustment query invalidation', () => {
  it('covers product, low-stock, summary, valuation and movement caches', () => {
    expect([...STOCK_ADJUSTMENT_QUERY_ROOTS]).toEqual([
      'products',
      'product',
      'pos-products',
      'low-stock-variants',
      'low-stock-count',
      'stock-summary',
      'stock-valuation',
      'recent-movements',
      'global-stock-movements',
      'stock-movements',
    ]);
  });

  it('returns one key tuple per root, with no duplicates', () => {
    const keys = stockAdjustmentQueryKeys();
    expect(keys).toHaveLength(STOCK_ADJUSTMENT_QUERY_ROOTS.length);
    expect(new Set(keys.map((key) => key[0])).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toHaveLength(1);
    }
  });

  it('includes the low-stock action target and both movement feeds', () => {
    const roots = new Set(STOCK_ADJUSTMENT_QUERY_ROOTS);
    expect(roots.has('low-stock-variants')).toBe(true);
    expect(roots.has('low-stock-count')).toBe(true);
    expect(roots.has('recent-movements')).toBe(true);
    expect(roots.has('global-stock-movements')).toBe(true);
  });
});
