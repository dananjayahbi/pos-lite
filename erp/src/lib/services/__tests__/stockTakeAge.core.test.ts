import { describe, expect, it } from 'vitest';

import { isStaleStockTake, stockTakeAgeDays } from '@/lib/services/stockTakeAge.core';

/** ARGUS #147: stale sessions are surfaced, never auto-mutated. */
describe('stock take ageing', () => {
  const now = new Date('2026-11-20T12:00:00Z');

  it('marks an unfinished session stale after seven days', () => {
    expect(isStaleStockTake('2026-11-01T09:00:00Z', 'IN_PROGRESS', now)).toBe(true);
    expect(isStaleStockTake('2026-11-01T09:00:00Z', 'PENDING_APPROVAL', now)).toBe(true);
  });

  it('keeps a recent session active', () => {
    expect(isStaleStockTake('2026-11-19T09:00:00Z', 'IN_PROGRESS', now)).toBe(false);
  });

  it('never marks terminal sessions stale', () => {
    expect(isStaleStockTake('2026-10-01T09:00:00Z', 'APPROVED', now)).toBe(false);
    expect(isStaleStockTake('2026-10-01T09:00:00Z', 'CANCELLED', now)).toBe(false);
  });

  it('reports age in whole days and tolerates invalid dates', () => {
    expect(stockTakeAgeDays('2026-11-10T09:00:00Z', now)).toBe(10);
    expect(stockTakeAgeDays('not-a-date', now)).toBeNull();
  });
});
