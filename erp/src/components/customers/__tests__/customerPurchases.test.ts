import { describe, expect, it } from 'vitest';

import { saleItemCount } from '@/components/customers/customerPurchases';

/** ARGUS #311: the purchase-history Items column must count units, not lines. */
describe('saleItemCount', () => {
  it('sums quantities across product lines', () => {
    expect(saleItemCount([{ quantity: 3 }, { quantity: 2 }])).toBe(5);
  });

  it('counts one line with multiple units as multiple items', () => {
    expect(saleItemCount([{ quantity: 4 }])).toBe(4);
  });

  it('returns zero for an empty or missing line list', () => {
    expect(saleItemCount([])).toBe(0);
    expect(saleItemCount(null)).toBe(0);
    expect(saleItemCount(undefined)).toBe(0);
  });

  it('ignores non-finite quantities instead of returning NaN', () => {
    expect(saleItemCount([{ quantity: 2 }, { quantity: Number.NaN }])).toBe(2);
  });
});
