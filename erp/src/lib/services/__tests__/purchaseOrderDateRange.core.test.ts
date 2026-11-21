import { describe, expect, it } from 'vitest';

import {
  buildPurchaseOrderDateRange,
  isValidIsoDay,
} from '@/lib/services/purchaseOrderDateRange.core';

/**
 * ARGUS #230: the filter targets the displayed Order Date, inclusive at both
 * local day edges. Expectations are built with the same local Date constructor,
 * so the suite passes in every timezone.
 */
describe('buildPurchaseOrderDateRange', () => {
  it('returns undefined when no bound is supplied', () => {
    expect(buildPurchaseOrderDateRange(undefined, undefined)).toBeUndefined();
    expect(buildPurchaseOrderDateRange('', '')).toBeUndefined();
  });

  it('starts the from day at local midnight', () => {
    const range = buildPurchaseOrderDateRange('2026-10-29', undefined);
    expect(range?.gte?.getTime()).toBe(new Date(2026, 9, 29, 0, 0, 0, 0).getTime());
    expect(range?.lte).toBeUndefined();
  });

  it('ends the to day at local 23:59:59.999', () => {
    const range = buildPurchaseOrderDateRange(undefined, '2026-10-29');
    expect(range?.lte?.getTime()).toBe(new Date(2026, 9, 29, 23, 59, 59, 999).getTime());
    expect(range?.gte).toBeUndefined();
  });

  it('includes a same-day order date at local noon', () => {
    const range = buildPurchaseOrderDateRange('2026-10-29', '2026-10-29');
    const noon = new Date(2026, 9, 29, 12, 0, 0, 0);
    expect(range?.gte!.getTime()).toBeLessThanOrEqual(noon.getTime());
    expect(range?.lte!.getTime()).toBeGreaterThanOrEqual(noon.getTime());
  });

  it('includes both bounds and spans a multi-day range', () => {
    const range = buildPurchaseOrderDateRange('2026-10-01', '2026-10-31');
    expect(range?.gte!.getTime()).toBe(new Date(2026, 9, 1).getTime());
    expect(range?.lte!.getTime()).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).getTime());
  });

  it('fails loudly on an invalid day instead of widening the range', () => {
    expect(() => buildPurchaseOrderDateRange('29/10/2026', undefined)).toThrow('INVALID_DATE_RANGE');
    expect(() => buildPurchaseOrderDateRange(undefined, '2026-02-31')).toThrow('INVALID_DATE_RANGE');
  });
});

describe('isValidIsoDay', () => {
  it('accepts real calendar days', () => {
    expect(isValidIsoDay('2026-10-29')).toBe(true);
    expect(isValidIsoDay('2024-02-29')).toBe(true);
  });

  it('rejects malformed values and rollover dates', () => {
    expect(isValidIsoDay('2026-2-9')).toBe(false);
    expect(isValidIsoDay('')).toBe(false);
    expect(isValidIsoDay('2026-02-31')).toBe(false);
    expect(isValidIsoDay('2026-13-01')).toBe(false);
  });
});
