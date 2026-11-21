import { describe, expect, it } from 'vitest';

import {
  computeMaterialCost,
  computeRawMaterialStockValue,
} from '@/lib/services/rawMaterialValuation.core';

/** ARGUS #243: raw-material stock and production consumption have a value. */
describe('raw-material valuation', () => {
  it('values the quantity on hand at the unit cost', () => {
    expect(computeRawMaterialStockValue(90, 4.5)).toBe(405);
    expect(computeRawMaterialStockValue(0.5, 120)).toBe(60);
  });

  it('never returns a negative value for bad input', () => {
    expect(computeRawMaterialStockValue(-10, 5)).toBe(0);
    expect(computeRawMaterialStockValue(10, -5)).toBe(0);
    expect(computeRawMaterialStockValue(Number.NaN, 5)).toBe(0);
  });

  it('values a production run from consumed quantities and costs', () => {
    // 90 L coconut oil at 4.50 + 1 kg cocoa at 1,200 = 1,605.
    expect(
      computeMaterialCost([
        { required: 90, unitCost: 4.5 },
        { required: 1, unitCost: 1200 },
      ]),
    ).toBe(1605);
  });

  it('rounds to two decimals and ignores non-positive lines', () => {
    expect(
      computeMaterialCost([
        { required: 3, unitCost: 1.111 },
        { required: 0, unitCost: 999 },
      ]),
    ).toBe(3.33);
  });
});
