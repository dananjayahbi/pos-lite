import { describe, expect, it } from 'vitest';

import { lowStockCardSubtitle } from '@/lib/dashboard/lowStockNote.core';

/** ARGUS #46: the Low Stock card must describe stock, not a stale shift. */
describe('lowStockCardSubtitle', () => {
  it('reports the count of variants at or below threshold', () => {
    expect(lowStockCardSubtitle(1)).toBe('1 variant at or below threshold');
    expect(lowStockCardSubtitle(6)).toBe('6 variants at or below threshold');
  });

  it('reports an all-clear state', () => {
    expect(lowStockCardSubtitle(0)).toBe('All variants adequately stocked');
    expect(lowStockCardSubtitle(-1)).toBe('All variants adequately stocked');
  });
});
