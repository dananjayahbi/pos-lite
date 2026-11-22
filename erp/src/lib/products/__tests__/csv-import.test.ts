import { describe, expect, it } from 'vitest';

import {
  summarizeProductImportRows,
  validateProductImportRow,
} from '@/lib/products/csv-import';

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    productName: 'Ashwagandha Powder',
    category: 'Herbal Powders',
    retailPrice: '950.00',
    costPrice: '650.00',
    taxRule: 'STANDARD_VAT',
    initialStock: '25',
    ...overrides,
  };
}

/** ARGUS #146 — silent degradation is replaced by per-row validation. */
describe('validateProductImportRow', () => {
  it('accepts a complete row and parses its numbers', () => {
    const result = validateProductImportRow(row(), 4);

    expect(result.ok).toBe(true);
    expect(result.rowNumber).toBe(4);
    expect(result.data).toMatchObject({
      productName: 'Ashwagandha Powder',
      category: 'Herbal Powders',
      retailPrice: 950,
      costPrice: 650,
      taxRule: 'STANDARD_VAT',
      initialStock: 25,
    });
  });

  it('rejects a missing cost instead of defaulting it to 0', () => {
    const result = validateProductImportRow(row({ costPrice: '' }), 7);

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Cost Price is required');
    expect(result.defaults.costPrice).toBe(true);
  });

  it('rejects non-positive cost and retail values', () => {
    expect(validateProductImportRow(row({ costPrice: '0' }), 1).ok).toBe(false);
    expect(validateProductImportRow(row({ costPrice: '-5' }), 1).ok).toBe(false);
    expect(validateProductImportRow(row({ retailPrice: '0' }), 1).ok).toBe(false);
    expect(validateProductImportRow(row({ retailPrice: 'abc' }), 1).ok).toBe(false);
  });

  it('rejects retail below cost', () => {
    const result = validateProductImportRow(
      row({ retailPrice: '500.00', costPrice: '650.00' }),
      2,
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Retail Price cannot be lower');
  });

  it('accepts every supported tax rule, case-insensitively', () => {
    for (const taxRule of ['STANDARD_VAT', 'SSCL', 'EXEMPT']) {
      const result = validateProductImportRow(row({ taxRule }), 1);
      expect(result.ok).toBe(true);
      expect(result.data?.taxRule).toBe(taxRule);
    }
    expect(validateProductImportRow(row({ taxRule: 'sscl' }), 1).data?.taxRule).toBe('SSCL');
  });

  it('defaults a blank tax rule to STANDARD_VAT and reports it', () => {
    const result = validateProductImportRow(row({ taxRule: '' }), 3);

    expect(result.ok).toBe(true);
    expect(result.data?.taxRule).toBe('STANDARD_VAT');
    expect(result.defaults.taxRule).toBe(true);
  });

  it('rejects an unknown tax rule', () => {
    const result = validateProductImportRow(row({ taxRule: 'ZERO_RATED' }), 5);

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Tax Rule must be one of');
  });

  it('defaults blank initial stock to 0 but keeps explicit 0 distinct', () => {
    const blank = validateProductImportRow(row({ initialStock: '' }), 1);
    expect(blank.ok).toBe(true);
    expect(blank.data?.initialStock).toBe(0);
    expect(blank.defaults.initialStock).toBe(true);

    const explicitZero = validateProductImportRow(row({ initialStock: '0' }), 1);
    expect(explicitZero.ok).toBe(true);
    expect(explicitZero.data?.initialStock).toBe(0);
    expect(explicitZero.defaults.initialStock).toBe(false);
  });

  it('rejects negative or fractional initial stock', () => {
    expect(validateProductImportRow(row({ initialStock: '-1' }), 1).ok).toBe(false);
    expect(validateProductImportRow(row({ initialStock: '1.5' }), 1).ok).toBe(false);
    expect(validateProductImportRow(row({ initialStock: 'ten' }), 1).ok).toBe(false);
  });

  it('validates optional wholesale price when supplied', () => {
    expect(validateProductImportRow(row({ wholesalePrice: '800' }), 1).ok).toBe(true);
    expect(validateProductImportRow(row({ wholesalePrice: '0' }), 1).ok).toBe(false);
    expect(validateProductImportRow(row({ wholesalePrice: 'free' }), 1).ok).toBe(false);
  });
});

describe('summarizeProductImportRows', () => {
  it('counts created, rejected, defaults and tax decisions', () => {
    const results = [
      validateProductImportRow(row({ taxRule: '', initialStock: '' }), 1),
      validateProductImportRow(row({ taxRule: 'EXEMPT', initialStock: '10' }), 2),
      validateProductImportRow(row({ costPrice: '' }), 3),
      validateProductImportRow(row({ retailPrice: '100', costPrice: '650' }), 4),
    ];

    const summary = summarizeProductImportRows(results);

    expect(summary.rowsReceived).toBe(4);
    expect(summary.rowsValid).toBe(2);
    expect(summary.rowsRejected).toBe(2);
    expect(summary.rejected).toEqual([
      expect.objectContaining({ rowNumber: 3 }),
      expect.objectContaining({ rowNumber: 4 }),
    ]);
    expect(summary.defaults).toEqual({
      taxRule: 1,
      initialStock: 1,
      costPrice: 1,
    });
    expect(summary.taxRuleCounts).toEqual({
      STANDARD_VAT: 1,
      SSCL: 0,
      EXEMPT: 1,
    });
  });

  it('reports an all-invalid import without claiming any valid rows', () => {
    const summary = summarizeProductImportRows([
      validateProductImportRow(row({ productName: '' }), 1),
      validateProductImportRow(row({ taxRule: 'BAD' }), 2),
    ]);

    expect(summary.rowsValid).toBe(0);
    expect(summary.rowsRejected).toBe(2);
    expect(summary.rejected.map((r) => r.rowNumber)).toEqual([1, 2]);
    expect(summary.taxRuleCounts).toEqual({ STANDARD_VAT: 0, SSCL: 0, EXEMPT: 0 });
  });
});
