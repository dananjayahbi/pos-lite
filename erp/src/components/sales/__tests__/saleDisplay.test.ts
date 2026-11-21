import { describe, expect, it } from 'vitest';

import { saleLineCount, saleUnitCount } from '@/components/sales/saleDisplay';

describe('sale display counts', () => {
  it('counts units, not lines, for the Items column', () => {
    const lines = [{ quantity: 2 }, { quantity: 1 }];
    expect(saleUnitCount(lines)).toBe(3);
    expect(saleLineCount(lines)).toBe(2);
  });

  it('reports one item for a single line with quantity 2 (ARGUS #81)', () => {
    expect(saleUnitCount([{ quantity: 2 }])).toBe(2);
  });

  it('is zero for an empty sale and ignores non-finite quantities', () => {
    expect(saleUnitCount([])).toBe(0);
    expect(saleUnitCount([{ quantity: Number.NaN }])).toBe(0);
  });
});
