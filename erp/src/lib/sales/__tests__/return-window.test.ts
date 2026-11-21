import { describe, expect, it } from 'vitest';

import {
  isReturnWindowExpired,
  RETURN_WINDOW_DAYS,
  saleReturnWindowEnd,
  saleReturnWindowStart,
} from '@/lib/sales/return-window';

describe('sale return window', () => {
  it('measures 30 days from the recorded selling date, not the entry time', () => {
    const sale = {
      saleDate: new Date(2026, 9, 28, 12, 0),
      createdAt: new Date(2026, 10, 20, 21, 11),
    };

    expect(saleReturnWindowStart(sale)).toEqual(new Date(2026, 9, 28, 12, 0));
    expect(saleReturnWindowEnd(sale)).toEqual(new Date(2026, 10, 27, 12, 0));
    expect(RETURN_WINDOW_DAYS).toBe(30);
  });

  it('is still returnable at the end instant and expired just after it', () => {
    const sale = {
      saleDate: new Date(2026, 9, 28, 12, 0),
      createdAt: new Date(2026, 10, 20, 21, 11),
    };
    const end = saleReturnWindowEnd(sale);

    expect(isReturnWindowExpired(sale, end)).toBe(false);
    expect(isReturnWindowExpired(sale, new Date(end.getTime() + 1))).toBe(true);
  });

  it('falls back to createdAt for legacy rows without a saleDate', () => {
    const sale = {
      saleDate: null,
      createdAt: new Date(2026, 9, 28, 21, 11),
    };

    expect(saleReturnWindowEnd(sale)).toEqual(new Date(2026, 10, 27, 21, 11));
  });

  it('accepts ISO strings from the list API', () => {
    const sale = {
      saleDate: new Date(2026, 9, 28, 12, 0).toISOString(),
      createdAt: new Date(2026, 10, 20, 21, 11).toISOString(),
    };

    expect(saleReturnWindowEnd(sale)).toEqual(new Date(2026, 10, 27, 12, 0));
  });
});
