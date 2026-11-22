import { describe, expect, it } from 'vitest';

import { stockAdjustmentRevalidationOptions } from '@/lib/website/storefront-revalidation.core';

/**
 * ARGUS #195 - single and bulk adjustments both revalidate the product detail
 * pages and catalog filters after a committed stock change.
 */
describe('stock adjustment storefront revalidation options', () => {
  it('deduplicates product ids (several variants can share a product)', () => {
    expect(
      stockAdjustmentRevalidationOptions(['p1', 'p2', 'p1', 'p2']),
    ).toEqual({ productIds: ['p1', 'p2'], catalog: true });
  });

  it('drops blank ids instead of sending them to the website', () => {
    expect(
      stockAdjustmentRevalidationOptions([null, undefined, '', 'p1']),
    ).toEqual({ productIds: ['p1'], catalog: true });
  });

  it('always purges the catalog even for an empty product list', () => {
    expect(stockAdjustmentRevalidationOptions([])).toEqual({
      productIds: [],
      catalog: true,
    });
  });

  it('preserves first-seen order for deterministic requests', () => {
    expect(
      stockAdjustmentRevalidationOptions(['p3', 'p1', 'p3']).productIds,
    ).toEqual(['p3', 'p1']);
  });
});
