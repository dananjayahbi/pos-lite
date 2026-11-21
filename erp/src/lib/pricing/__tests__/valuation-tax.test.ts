import { describe, expect, it } from 'vitest';

import {
  readValuationTaxRates,
  summarizeValuationTax,
  valuationMarginPercent,
} from '@/lib/pricing/valuation-tax.core';

/**
 * ARGUS #145 — pre-tax retail plus per-line VAT/SSCL/exempt handling.
 */
describe('summarizeValuationTax', () => {
  const rates = { vatRate: 18, ssclRate: 2.5 };

  it('adds 18% VAT to a standard-rated line', () => {
    const result = summarizeValuationTax(
      [{ retailValue: 1000, taxRule: 'STANDARD_VAT' }],
      rates,
    );

    expect(result.retailValueExTax.toNumber()).toBe(1000);
    expect(result.vatAmount.toNumber()).toBe(180);
    expect(result.taxAmount.toNumber()).toBe(180);
    expect(result.retailValueInclTax.toNumber()).toBe(1180);
  });

  it('adds nothing for an exempt line', () => {
    const result = summarizeValuationTax(
      [{ retailValue: 500, taxRule: 'EXEMPT' }],
      rates,
    );

    expect(result.vatAmount.toNumber()).toBe(0);
    expect(result.retailValueInclTax.toNumber()).toBe(500);
  });

  it('handles a mixed basket with VAT, SSCL and exempt lines', () => {
    const result = summarizeValuationTax(
      [
        { retailValue: 1000, taxRule: 'STANDARD_VAT' },
        { retailValue: 400, taxRule: 'SSCL' },
        { retailValue: 500, taxRule: 'EXEMPT' },
      ],
      rates,
    );

    expect(result.retailValueExTax.toNumber()).toBe(1900);
    expect(result.vatAmount.toNumber()).toBe(180);
    expect(result.ssclAmount.toNumber()).toBe(10);
    expect(result.taxAmount.toNumber()).toBe(190);
    expect(result.retailValueInclTax.toNumber()).toBe(2090);
  });

  it('rounds each line to cents', () => {
    const result = summarizeValuationTax(
      [{ retailValue: '999.99', taxRule: 'STANDARD_VAT' }],
      rates,
    );

    expect(result.vatAmount.toFixed(2)).toBe('180.00');
    expect(result.retailValueInclTax.toFixed(2)).toBe('1179.99');
  });
});

describe('readValuationTaxRates', () => {
  it('reads numbers and defaults to zero', () => {
    expect(readValuationTaxRates({ vatRate: 18, ssclRate: 2.5 })).toEqual({
      vatRate: 18,
      ssclRate: 2.5,
    });
    expect(readValuationTaxRates(null)).toEqual({ vatRate: 0, ssclRate: 0 });
  });
});

describe('valuationMarginPercent', () => {
  it('keeps two-decimal precision (58.88%, not 58.9%)', () => {
    expect(valuationMarginPercent(1000, 411.2)).toBe(58.88);
  });

  it('returns zero for an empty retail value', () => {
    expect(valuationMarginPercent(0, 100)).toBe(0);
  });
});
