import { describe, it, expect } from 'vitest';

import { netUnitsSold, salesProductLabel } from '@/lib/reports/sales-report';

describe('sales report labels and net units', () => {
  it('appends the variant so duplicate product bars are distinguishable', () => {
    const base = { productName: 'Bhringraj Hair Oil' };
    expect(
      salesProductLabel({ ...base, variantDescription: 'OIL / 100ml' }),
    ).toBe('Bhringraj Hair Oil - OIL / 100ml');
    expect(
      salesProductLabel({ ...base, variantDescription: 'OIL / 500ml' }),
    ).toBe('Bhringraj Hair Oil - OIL / 500ml');
  });

  it('falls back to the product name when there is no variant label', () => {
    expect(
      salesProductLabel({ productName: 'Brahmi Powder', variantDescription: '—' }),
    ).toBe('Brahmi Powder');
    expect(salesProductLabel({ productName: 'Brahmi Powder' })).toBe(
      'Brahmi Powder',
    );
  });

  it('reports units kept after returns', () => {
    expect(netUnitsSold(3, 1)).toBe(2);
    expect(netUnitsSold(2, 0)).toBe(2);
  });
});
