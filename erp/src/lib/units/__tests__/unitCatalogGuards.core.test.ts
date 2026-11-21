import { describe, expect, it } from 'vitest';

import { unitDeleteBlock } from '@/lib/units/unitDeleteGuard.core';
import { builtInRowIdsToRevive } from '@/lib/units/unitSeed.core';

/**
 * ARGUS #485: regression coverage for the unit delete guards and lazy-seed
 * restoration, neither of which had a Units spec before.
 */
describe('unit delete guards', () => {
  const base = { isBuiltIn: false, liveUsage: 0, remainingLiveUnits: 2 };

  it('blocks deletion of a built-in even when unused', () => {
    expect(unitDeleteBlock({ ...base, isBuiltIn: true })).toBe('BUILT_IN_UNIT');
  });

  it('blocks deletion of a unit used by live materials', () => {
    expect(unitDeleteBlock({ ...base, liveUsage: 5 })).toBe('UNIT_IN_USE');
  });

  it('blocks deleting the last remaining unit', () => {
    expect(unitDeleteBlock({ ...base, remainingLiveUnits: 0 })).toBe('LAST_UNIT');
  });

  it('allows deletion of an unused custom unit with siblings', () => {
    expect(unitDeleteBlock(base)).toBeNull();
  });

  it('prefers the built-in guard over usage and last-unit', () => {
    expect(
      unitDeleteBlock({
        isBuiltIn: true,
        liveUsage: 4,
        remainingLiveUnits: 0,
      }),
    ).toBe('BUILT_IN_UNIT');
  });
});

describe('built-in seed revival', () => {
  const keys = new Set(['KILOGRAMS', 'LITERS', 'UNITS']);

  it('revives a soft-deleted built-in and leaves live rows alone', () => {
    expect(
      builtInRowIdsToRevive(
        [
          { id: 'u1', key: 'LITERS', deletedAt: new Date() },
          { id: 'u2', key: 'KILOGRAMS', deletedAt: null },
          { id: 'u3', key: 'UNITS', deletedAt: '2026-01-01' },
        ],
        keys,
      ),
    ).toEqual(['u1', 'u3']);
  });

  it('never revives a custom unit', () => {
    expect(
      builtInRowIdsToRevive(
        [{ id: 'c1', key: 'BOTTLES', deletedAt: new Date() }],
        keys,
      ),
    ).toEqual([]);
  });
});
