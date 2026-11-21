import { describe, expect, it } from 'vitest';

import {
  EMPTY_SHIFT_STATUS_COUNTS,
  toShiftStatusCounts,
} from '@/lib/shifts/shift-status-counts';

describe('shift status counts (ARGUS #116)', () => {
  it('counts the whole filtered set, not only the page rows', () => {
    // 20 rows on page 1, 43 filtered shifts in total.
    expect(
      toShiftStatusCounts([
        { status: 'OPEN', count: 7 },
        { status: 'CLOSED', count: 36 },
      ]),
    ).toEqual({ open: 7, closed: 36 });
  });

  it('returns zeroes for no groups or an empty payload', () => {
    expect(toShiftStatusCounts([])).toEqual(EMPTY_SHIFT_STATUS_COUNTS);
    expect(toShiftStatusCounts(undefined)).toEqual(EMPTY_SHIFT_STATUS_COUNTS);
    expect(toShiftStatusCounts(null)).toEqual(EMPTY_SHIFT_STATUS_COUNTS);
  });

  it('ignores unknown statuses instead of inventing a bucket', () => {
    expect(
      toShiftStatusCounts([
        { status: 'OPEN', count: 2 },
        { status: 'SOMETHING_ELSE', count: 9 },
      ]),
    ).toEqual({ open: 2, closed: 0 });
  });

  it('does not mutate the shared empty constant', () => {
    const counts = toShiftStatusCounts([{ status: 'OPEN', count: 1 }]);
    counts.open += 5;
    expect(EMPTY_SHIFT_STATUS_COUNTS.open).toBe(0);
  });
});
