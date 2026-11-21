import { describe, expect, it } from 'vitest';

import {
  isQaFixtureBrandName,
  summarizeBrandFixtures,
} from '@/lib/brands/brandFixtureHygiene.core';

/** ARGUS #179: detect the QA brand artefacts without mutating live data. */
describe('brand fixture hygiene', () => {
  it('matches the two documented QA brands case-insensitively', () => {
    expect(isQaFixtureBrandName('Master Aqua')).toBe(true);
    expect(isQaFixtureBrandName('  test br ')).toBe(true);
  });

  it('matches the Test … naming convention', () => {
    expect(isQaFixtureBrandName('Test Brand')).toBe(true);
  });

  it('does not match a real brand', () => {
    expect(isQaFixtureBrandName('Baidyanath')).toBe(false);
    expect(isQaFixtureBrandName('Contest Labs')).toBe(false);
    expect(isQaFixtureBrandName(null)).toBe(false);
  });

  it('separates live and soft-deleted fixtures', () => {
    const summary = summarizeBrandFixtures([
      { id: 'b1', name: 'Master Aqua', deletedAt: null },
      { id: 'b2', name: 'Test BR', deletedAt: new Date('2026-01-01') },
      { id: 'b3', name: 'Baidyanath', deletedAt: null },
    ]);

    expect(summary).toEqual({
      total: 2,
      live: 1,
      deleted: 1,
      liveIds: ['b1'],
      deletedIds: ['b2'],
    });
  });
});
