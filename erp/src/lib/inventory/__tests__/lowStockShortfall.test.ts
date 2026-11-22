import { describe, expect, it } from 'vitest';

import { resolveLowStockShortfall } from '@/lib/inventory/lowStockShortfall';

/**
 * ARGUS #144 — the low-stock table must never render a negative requirement or
 * "-0": the shortfall is a positive gap with an explicit label.
 */
describe('resolveLowStockShortfall', () => {
  it('reports a positive gap below the threshold', () => {
    expect(resolveLowStockShortfall(3, 5)).toEqual({ amount: 2, label: '2 short' });
  });

  it('labels an exact match as at threshold, never "-0"', () => {
    expect(resolveLowStockShortfall(5, 5)).toEqual({ amount: 0, label: 'At threshold' });
  });

  it('never reports a negative amount above the threshold', () => {
    expect(resolveLowStockShortfall(6, 5)).toEqual({
      amount: 0,
      label: 'Above threshold',
    });
  });

  it('treats zero and negative stock as a positive gap', () => {
    expect(resolveLowStockShortfall(0, 5)).toEqual({ amount: 5, label: '5 short' });
    expect(resolveLowStockShortfall(-2, 5)).toEqual({ amount: 7, label: '7 short' });
  });

  it('handles decimal stock and thresholds', () => {
    expect(resolveLowStockShortfall(1.5, 2)).toEqual({ amount: 0.5, label: '0.5 short' });
    expect(resolveLowStockShortfall(1.25, 1.3)).toEqual({
      amount: 0.05,
      label: '0.05 short',
    });
    expect(resolveLowStockShortfall(1.3, 1.3)).toEqual({
      amount: 0,
      label: 'At threshold',
    });
  });

  it('does not render "0 short" for a sub-0.01 gap', () => {
    expect(resolveLowStockShortfall(4.999, 5)).toEqual({
      amount: 0,
      label: 'At threshold',
    });
  });

  it('falls back safely for non-finite values', () => {
    expect(resolveLowStockShortfall(Number.NaN, 5)).toEqual({
      amount: 0,
      label: 'At threshold',
    });
    expect(resolveLowStockShortfall(3, Number.POSITIVE_INFINITY)).toEqual({
      amount: 0,
      label: 'At threshold',
    });
  });
});
