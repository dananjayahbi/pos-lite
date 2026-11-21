import { describe, expect, it } from 'vitest';

import {
  LOW_STOCK_PRODUCT_SCOPE_SQL,
  LOW_STOCK_SQL_PREDICATE,
  isLowStockVariant,
} from '@/lib/inventory/lowStockPredicate';

/**
 * ARGUS #215 - threshold 0 disables low-stock alerting everywhere; a positive
 * threshold alerts at or below it.
 */
describe('low-stock predicate', () => {
  it('includes a positive-threshold variant at or below its threshold', () => {
    expect(isLowStockVariant({ stockQuantity: 5, lowStockThreshold: 5 })).toBe(true);
    expect(isLowStockVariant({ stockQuantity: 0, lowStockThreshold: 5 })).toBe(true);
    expect(isLowStockVariant({ stockQuantity: 3, lowStockThreshold: 5 })).toBe(true);
  });

  it('excludes a positive-threshold variant above its threshold', () => {
    expect(isLowStockVariant({ stockQuantity: 6, lowStockThreshold: 5 })).toBe(false);
  });

  it('treats threshold 0 as disabled, including at zero stock', () => {
    expect(isLowStockVariant({ stockQuantity: 0, lowStockThreshold: 0 })).toBe(false);
    expect(isLowStockVariant({ stockQuantity: 3, lowStockThreshold: 0 })).toBe(false);
  });

  it('rejects non-finite values instead of counting them', () => {
    expect(isLowStockVariant({ stockQuantity: Number.NaN, lowStockThreshold: 5 })).toBe(false);
    expect(
      isLowStockVariant({ stockQuantity: 0, lowStockThreshold: Number.POSITIVE_INFINITY }),
    ).toBe(false);
  });

  it('keeps the SQL predicate aligned with the JS rule', () => {
    expect(LOW_STOCK_SQL_PREDICATE).toContain('"lowStockThreshold" > 0');
    expect(LOW_STOCK_SQL_PREDICATE).toContain('"stockQuantity" <= pv."lowStockThreshold"');
  });

  it('excludes archived and deleted products from every low-stock counter (ARGUS #49)', () => {
    expect(LOW_STOCK_PRODUCT_SCOPE_SQL).toContain('p."isArchived" = false');
    expect(LOW_STOCK_PRODUCT_SCOPE_SQL).toContain('p."deletedAt" IS NULL');
  });
});
