import { describe, expect, it } from 'vitest';

import {
  buildValuationCsv,
  valuationCsvFilename,
  type ValuationCsvSnapshot,
} from '@/lib/pricing/valuationCsv.core';

const snapshot: ValuationCsvSnapshot = {
  retailValue: 2000,
  vatAmount: 216.09,
  ssclAmount: 0,
  taxAmount: 216.09,
  retailValueInclTax: 2216.09,
  taxRates: { vatRate: 18, ssclRate: 2.5 },
  costValue: 1000.25,
  rawMaterialValue: 250,
  totalCostValue: 1250.25,
  estimatedMargin: 999.75,
  estimatedMarginPercent: 49.99,
  variantCount: 5,
  categoryBreakdown: [
    {
      categoryName: 'Hair Care',
      variantCount: 3,
      retailValue: 1200.5,
      taxAmount: 216.09,
      retailValueInclTax: 1416.59,
      costValue: 600.25,
    },
    {
      categoryName: 'Powders',
      variantCount: 2,
      retailValue: 799.5,
      taxAmount: 0,
      retailValueInclTax: 799.5,
      costValue: 400,
    },
  ],
  calculatedAt: '2026-11-22T05:04:12.000Z',
};

describe('buildValuationCsv (ARGUS #223)', () => {
  it('states the snapshot timestamp it was generated from', () => {
    const csv = buildValuationCsv(snapshot);
    expect(csv.split('\n')[1]).toBe('As of,2026-11-22T05:04:12.000Z');
  });

  it('writes a totals row that reconciles to the summary', () => {
    const csv = buildValuationCsv(snapshot);
    const lines = csv.split('\n');

    expect(lines).toContain(
      'Total,5,2000.00,216.09,2216.09,1000.25,49.99,100.00',
    );
    expect(lines).toContain('VAT (18%),216.09');
    expect(lines).toContain('SSCL (2.5%),0.00');
  });

  it('quotes category names containing a comma', () => {
    const csv = buildValuationCsv({
      ...snapshot,
      categoryBreakdown: [
        {
          categoryName: 'Oils, Balms',
          variantCount: 1,
          retailValue: 10,
          taxAmount: 0,
          retailValueInclTax: 10,
          costValue: 5,
        },
      ],
    });
    expect(csv).toContain('"Oils, Balms",1,10.00');
  });

  it('handles an empty snapshot without dividing by zero', () => {
    const csv = buildValuationCsv({
      ...snapshot,
      retailValue: 0,
      vatAmount: 0,
      ssclAmount: 0,
      taxAmount: 0,
      retailValueInclTax: 0,
      costValue: 0,
      categoryBreakdown: [],
      variantCount: 0,
    });
    expect(csv).toContain('Total,0,0.00,0.00,0.00,0.00,0.00,0.00');
  });
});

describe('valuationCsvFilename (ARGUS #223)', () => {
  it('includes the time so same-day exports are distinguishable', () => {
    expect(valuationCsvFilename('2026-11-22T05:04:12.000Z')).toBe(
      'stock-valuation-2026-11-22-0504.csv',
    );
  });

  it('falls back to a stable name for an invalid timestamp', () => {
    expect(valuationCsvFilename('not-a-date')).toBe('stock-valuation.csv');
  });
});
