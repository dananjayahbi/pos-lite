import { describe, expect, it } from 'vitest';

import { sumValuationBreakdown } from '@/lib/pricing/valuationTotals.core';

describe('sumValuationBreakdown (ARGUS #220)', () => {
  const rows = [
    {
      variantCount: 3,
      retailValue: 1200.5,
      vatAmount: 216.09,
      ssclAmount: 0,
      taxAmount: 216.09,
      retailValueInclTax: 1416.59,
      costValue: 600.25,
    },
    {
      variantCount: 2,
      retailValue: 799.5,
      vatAmount: 0,
      ssclAmount: 39.98,
      taxAmount: 39.98,
      retailValueInclTax: 839.48,
      costValue: 400,
    },
  ];

  it('returns column sums so cards match the table footer', () => {
    expect(sumValuationBreakdown(rows)).toEqual({
      variantCount: 5,
      retailValue: '2000.00',
      vatAmount: '216.09',
      ssclAmount: '39.98',
      taxAmount: '256.07',
      retailValueInclTax: '2256.07',
      costValue: '1000.25',
    });
  });

  it('adds a retail total that equals the sum of category retail', () => {
    const totals = sumValuationBreakdown(rows);
    const categorySum = rows.reduce((sum, row) => sum + row.retailValue, 0);
    expect(Number(totals.retailValue)).toBe(categorySum);
  });

  it('handles an empty snapshot', () => {
    expect(sumValuationBreakdown([])).toEqual({
      variantCount: 0,
      retailValue: '0.00',
      vatAmount: '0.00',
      ssclAmount: '0.00',
      taxAmount: '0.00',
      retailValueInclTax: '0.00',
      costValue: '0.00',
    });
  });
});
