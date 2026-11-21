import { describe, expect, it } from 'vitest';

import { formatUnitUsage } from '@/lib/units/unitUsage.core';

/** ARGUS #483: archived references must be disclosed in the usage column. */
describe('formatUnitUsage', () => {
  it('shows only the live count when nothing is archived', () => {
    expect(formatUnitUsage(1)).toBe('1 material');
    expect(formatUnitUsage(3, 0)).toBe('3 materials');
  });

  it('discloses archived references next to the live count', () => {
    expect(formatUnitUsage(1, 4)).toBe('1 material (4 archived)');
  });
});
