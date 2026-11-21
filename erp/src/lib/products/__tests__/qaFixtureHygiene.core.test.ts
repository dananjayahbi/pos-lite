import { describe, expect, it } from 'vitest';

import {
  isQaFixtureProductName,
  QA_FIXTURE_NAME_PREFIX,
  summarizeQaFixtures,
} from '@/lib/products/qaFixtureHygiene.core';

/**
 * ARGUS #155: 5 of 12 live products were `QA Replacement Fixture …` rows.
 * Detection must match only that documented prefix, and must separate live
 * rows (safe to soft-delete) from rows that are already deleted.
 */
describe('QA inventory fixture detection', () => {
  it('matches the documented fixture prefix case-insensitively', () => {
    expect(isQaFixtureProductName(`${QA_FIXTURE_NAME_PREFIX} 01`)).toBe(true);
    expect(isQaFixtureProductName('  qa replacement fixture — oil')).toBe(true);
  });

  it('does not match real catalogue names or empty values', () => {
    expect(isQaFixtureProductName('Mahanarayan Oil')).toBe(false);
    expect(isQaFixtureProductName('QA OIL')).toBe(false);
    expect(isQaFixtureProductName(null)).toBe(false);
    expect(isQaFixtureProductName(undefined)).toBe(false);
    expect(isQaFixtureProductName('   ')).toBe(false);
  });

  it('separates live fixtures from already-deleted fixtures', () => {
    const summary = summarizeQaFixtures([
      { id: 'p1', name: `${QA_FIXTURE_NAME_PREFIX} A`, deletedAt: null },
      { id: 'p2', name: `QA REPLACEMENT FIXTURE B`, deletedAt: '2026-11-01T00:00:00Z' },
      { id: 'p3', name: 'Mahanarayan Oil', deletedAt: null },
    ]);

    expect(summary).toEqual({
      total: 2,
      live: 1,
      deleted: 1,
      liveIds: ['p1'],
      deletedIds: ['p2'],
    });
  });
});
