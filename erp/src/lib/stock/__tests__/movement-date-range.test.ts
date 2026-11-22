import { describe, expect, it } from 'vitest';

import { movementDateRangeError } from '@/lib/stock/movement-date-range';

describe('movement date range (ARGUS #204)', () => {
  it('accepts an ordered or partial range', () => {
    expect(movementDateRangeError('2026-11-01', '2026-11-20')).toBeNull();
    expect(movementDateRangeError('2026-11-01', '')).toBeNull();
    expect(movementDateRangeError('', '2026-11-20')).toBeNull();
    expect(movementDateRangeError('2026-11-20', '2026-11-20')).toBeNull();
  });

  it('rejects From after To', () => {
    expect(movementDateRangeError('2026-11-20', '2026-11-15')).toBe(
      'From must be on or before To',
    );
  });

  it('rejects malformed days', () => {
    expect(movementDateRangeError('20/11/2026', '2026-11-15')).toBe('Enter valid dates');
  });
});
