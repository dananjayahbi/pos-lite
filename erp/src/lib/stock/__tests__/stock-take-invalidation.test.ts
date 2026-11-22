import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  STOCK_ADJUSTMENT_QUERY_ROOTS,
  stockAdjustmentQueryKeys,
} from '@/lib/stock/query-invalidation';
import { stockAdjustmentRevalidationOptions } from '@/lib/website/storefront-revalidation.core';

/**
 * ARGUS #210 - approving or cancelling a stock take must refresh the same
 * stock caches and storefront paths as a manual adjustment.
 */
function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8');
}

describe('stock-take post-action invalidation', () => {
  it('reuses the adjustment key list', () => {
    const roots = new Set(STOCK_ADJUSTMENT_QUERY_ROOTS);
    for (const root of [
      'products',
      'low-stock-variants',
      'low-stock-count',
      'stock-summary',
      'stock-valuation',
      'recent-movements',
      'global-stock-movements',
    ]) {
      expect(roots.has(root as never), root).toBe(true);
    }
    expect(stockAdjustmentQueryKeys()).toHaveLength(STOCK_ADJUSTMENT_QUERY_ROOTS.length);
  });

  it('builds storefront args with a catalog purge', () => {
    expect(stockAdjustmentRevalidationOptions(['p1', 'p1', null, 'p2'])).toEqual({
      productIds: ['p1', 'p2'],
      catalog: true,
    });
  });

  it('wires the shared invalidation into approve and cancel UIs', () => {
    for (const component of [
      'components/stock-control/StockTakeReview.tsx',
      'components/stock-control/StockTakeList.tsx',
    ]) {
      const source = readSource(component);
      expect(source, component).toContain('useInvalidateStockQueries');
      expect(source, component).toContain('invalidateStockQueries()');
    }
  });

  it('revalidates the storefront in both stock-take routes', () => {
    for (const route of [
      'app/api/store/stock-control/stock-takes/[sessionId]/approve/route.ts',
      'app/api/store/stock-control/stock-takes/[sessionId]/cancel/route.ts',
    ]) {
      const source = readSource(route);
      expect(source, route).toContain('revalidateTenantStorefront');
      expect(source, route).toContain('stockAdjustmentRevalidationOptions');
    }
  });
});
