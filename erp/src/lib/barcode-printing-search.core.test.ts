import { describe, expect, it } from 'vitest';

import { selectBarcodeSearchRows } from '@/lib/barcode-printing-search.core';

const rows = [
  { productName: 'Mahanarayan Oil', sku: 'MGH-100', barcode: '2003424422401' },
  { productName: 'Mahanarayan Oil', sku: 'MGH-200', barcode: '2003424422418' },
  { productName: 'Mahanarayan Oil', sku: 'MGH-500', barcode: '2003424422425' },
  { productName: 'Triphala Churna', sku: 'TRI-100', barcode: '2003424430001' },
];

/** ARGUS #159: an exact barcode must not offer sibling packs as equal rows. */
describe('selectBarcodeSearchRows', () => {
  it('keeps every row when the search is empty', () => {
    const result = selectBarcodeSearchRows(rows, '   ');

    expect(result).toHaveLength(4);
    expect(result.every((entry) => entry.match === 'none')).toBe(true);
  });

  it('returns only the exact barcode match', () => {
    const result = selectBarcodeSearchRows(rows, '2003424422401');

    expect(result.map((entry) => entry.row.sku)).toEqual(['MGH-100']);
    expect(result[0]!.match).toBe('exact');
  });

  it('matches an exact SKU case-insensitively', () => {
    const result = selectBarcodeSearchRows(rows, ' mgh-200 ');

    expect(result.map((entry) => entry.row.sku)).toEqual(['MGH-200']);
    expect(result[0]!.match).toBe('exact');
  });

  it('keeps all variants for a product-name search', () => {
    const result = selectBarcodeSearchRows(rows, 'mahanarayan');

    expect(result.map((entry) => entry.row.sku)).toEqual([
      'MGH-100',
      'MGH-200',
      'MGH-500',
    ]);
    expect(result.every((entry) => entry.match === 'product')).toBe(true);
  });

  it('narrows partial SKU/barcode hits instead of returning sibling packs', () => {
    const result = selectBarcodeSearchRows(rows, 'MGH-5');

    expect(result.map((entry) => entry.row.sku)).toEqual(['MGH-500']);
    expect(result[0]!.match).toBe('variant');
  });

  it('returns nothing when no product or variant matches', () => {
    expect(selectBarcodeSearchRows(rows, 'does-not-exist')).toEqual([]);
  });
});
