import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
} from '@/lib/constants/permissions';

/**
 * ARGUS #185 - the valuation page, the Stock Control value card and the
 * valuation API must agree on `stock:valuation:view`. STOCK_CLERK holds the
 * narrower product cost-price key, so gating any surface on that key shows
 * data (or KPI cards) the API immediately refuses.
 */
const VALUATION_PERMISSION = PERMISSIONS.STOCK.viewStockValuation;

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8');
}

describe('stock valuation permission', () => {
  it('grants the dedicated key to OWNER and MANAGER but not STOCK_CLERK', () => {
    expect(getEffectivePermissions('OWNER', [])).toContain(VALUATION_PERMISSION);
    expect(getEffectivePermissions('MANAGER', [])).toContain(VALUATION_PERMISSION);

    expect(ROLE_PERMISSIONS.STOCK_CLERK).toContain(PERMISSIONS.PRODUCT.viewCostPrice);
    expect(ROLE_PERMISSIONS.STOCK_CLERK).not.toContain(VALUATION_PERMISSION);
    expect(getEffectivePermissions('STOCK_CLERK', [])).not.toContain(VALUATION_PERMISSION);
  });

  it('gates the valuation page, Stock Control card and dashboard widget consistently', () => {
    const surfaces = [
      'components/stock-control/StockValuationClient.tsx',
      'components/stock-control/StockControlDashboard.tsx',
      'components/dashboard/StockSummaryWidgets.tsx',
    ];

    for (const surface of surfaces) {
      const source = readSource(surface);
      expect(source, `${surface} must use the valuation permission`).toContain(
        'PERMISSIONS.STOCK.viewStockValuation',
      );
      expect(source, `${surface} must not gate valuation on cost-price`).not.toContain(
        "'product:view_cost_price'",
      );
    }
  });

  it('keeps the valuation API on the same key', () => {
    const source = readSource('app/api/store/stock-control/valuation/route.ts');
    expect(source).toContain('PERMISSIONS.STOCK.viewStockValuation');
  });
});
