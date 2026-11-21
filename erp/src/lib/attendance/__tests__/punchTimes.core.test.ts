import { describe, expect, it } from 'vitest';

import {
  findOverlappingPunch,
  punchOverlaps,
  validatePunchTimes,
} from '@/lib/attendance/punchTimes.core';

/** ARGUS #349 — adding a missing punch must obey the clock rules. */

const NOW = new Date(2026, 10, 20, 18, 0, 0, 0); // Fri 20 Nov 2026, 18:00

function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 10, day, hour, minute, 0, 0);
}

describe('validatePunchTimes', () => {
  it('accepts a normal closed punch in the past', () => {
    expect(
      validatePunchTimes({ clockedInAt: at(14, 9), clockedOutAt: at(14, 17) }, NOW),
    ).toBeNull();
  });

  it('accepts an open punch for today', () => {
    expect(validatePunchTimes({ clockedInAt: at(20, 9), clockedOutAt: null }, NOW)).toBeNull();
  });

  it('requires a clock-out for a punch on a past day', () => {
    const error = validatePunchTimes({ clockedInAt: at(14, 9), clockedOutAt: null }, NOW);
    expect(error?.field).toBe('clockedOutAt');
    expect(error?.message).toMatch(/past day/i);
  });

  it('rejects clock-out at or before clock-in', () => {
    expect(
      validatePunchTimes({ clockedInAt: at(14, 9), clockedOutAt: at(14, 9) }, NOW)?.message,
    ).toBe('Clock-out must be after clock-in');
    expect(
      validatePunchTimes({ clockedInAt: at(14, 10), clockedOutAt: at(14, 9) }, NOW)?.message,
    ).toBe('Clock-out must be after clock-in');
  });

  it('rejects future punch times', () => {
    expect(validatePunchTimes({ clockedInAt: at(21, 9), clockedOutAt: null }, NOW)?.message).toBe(
      'Clock-in cannot be in the future',
    );
    expect(
      validatePunchTimes({ clockedInAt: at(20, 9), clockedOutAt: at(20, 19) }, NOW)?.message,
    ).toBe('Clock-out cannot be in the future');
  });

  it('rejects an invalid date', () => {
    expect(
      validatePunchTimes({ clockedInAt: new Date('nonsense'), clockedOutAt: null }, NOW)?.message,
    ).toBe('Enter a valid clock-in time');
  });
});

describe('punchOverlaps', () => {
  it('detects a punch fully inside another', () => {
    expect(
      punchOverlaps(
        { clockedInAt: at(14, 10), clockedOutAt: at(14, 11) },
        { clockedInAt: at(14, 9), clockedOutAt: at(14, 17) },
        NOW,
      ),
    ).toBe(true);
  });

  it('detects a punch that straddles another', () => {
    expect(
      punchOverlaps(
        { clockedInAt: at(14, 8), clockedOutAt: at(14, 10) },
        { clockedInAt: at(14, 9), clockedOutAt: at(14, 12) },
        NOW,
      ),
    ).toBe(true);
  });

  it('allows back-to-back punches', () => {
    expect(
      punchOverlaps(
        { clockedInAt: at(14, 10), clockedOutAt: at(14, 12) },
        { clockedInAt: at(14, 8), clockedOutAt: at(14, 10) },
        NOW,
      ),
    ).toBe(false);
  });

  it('treats an open punch as extending to now', () => {
    expect(
      punchOverlaps(
        { clockedInAt: at(20, 9), clockedOutAt: null },
        { clockedInAt: at(20, 12), clockedOutAt: at(20, 13) },
        NOW,
      ),
    ).toBe(true);
    expect(
      punchOverlaps(
        { clockedInAt: at(20, 14), clockedOutAt: null },
        { clockedInAt: at(20, 9), clockedOutAt: at(20, 12) },
        NOW,
      ),
    ).toBe(false);
  });
});

describe('findOverlappingPunch', () => {
  it('returns the conflicting punch by id', () => {
    const found = findOverlappingPunch(
      { clockedInAt: at(14, 9), clockedOutAt: at(14, 12) },
      [
        { id: 'a', clockedInAt: at(14, 7), clockedOutAt: at(14, 8) },
        { id: 'b', clockedInAt: at(14, 11), clockedOutAt: at(14, 17) },
      ],
      NOW,
    );
    expect(found?.id).toBe('b');
  });

  it('returns null when nothing overlaps', () => {
    expect(
      findOverlappingPunch(
        { clockedInAt: at(14, 9), clockedOutAt: at(14, 12) },
        [{ id: 'a', clockedInAt: at(14, 13), clockedOutAt: at(14, 17) }],
        NOW,
      ),
    ).toBeNull();
  });
});
