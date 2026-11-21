import { describe, expect, it } from 'vitest';

import { saleEmptyState, saleLineCount, saleUnitCount } from '@/components/sales/saleDisplay';

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

describe('sales empty state (ARGUS #84)', () => {
  const base = { hasStatusFilter: false, hasPaymentFilter: false };

  it('names the active Today range instead of saying No sales found', () => {
    const state = saleEmptyState({ ...base, preset: 'today' });
    expect(state.title).toBe('No sales today');
    expect(state.hint).toContain('older sales');
  });

  it('names a non-today range', () => {
    expect(saleEmptyState({ ...base, preset: 'lastMonth' }).title).toBe(
      'No sales in this date range',
    );
  });

  it('reports an active filter instead of blaming the date range', () => {
    expect(
      saleEmptyState({ ...base, preset: 'today', hasPaymentFilter: true }).title,
    ).toBe('No sales match these filters');
  });
});
