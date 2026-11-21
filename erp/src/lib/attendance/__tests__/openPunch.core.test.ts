import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_SHIFT_MINUTES,
  capPunchEnd,
  cappedOpenPunchMinutes,
  describeClockInConflict,
  isPunchOverdue,
} from '@/lib/attendance/openPunch.core';

/** ARGUS #351 — forgotten clock-outs must cap and prompt, never grow forever. */

// Fri 20 Nov 2026, 09:00 (open) and Sat 21 Nov 2026, 09:00 ("now").
const OPENED = new Date(2026, 10, 20, 9, 0, 0, 0);
const NOW = new Date(2026, 10, 21, 9, 0, 0, 0); // 24h later

describe('capPunchEnd', () => {
  it('caps an overdue punch at the maximum shift', () => {
    expect(capPunchEnd(OPENED, NOW).getTime()).toBe(
      OPENED.getTime() + DEFAULT_MAX_SHIFT_MINUTES * 60_000,
    );
  });

  it('uses now while the punch is still inside the maximum', () => {
    const twoHoursLater = new Date(OPENED.getTime() + 2 * 3_600_000);
    expect(capPunchEnd(OPENED, twoHoursLater).getTime()).toBe(twoHoursLater.getTime());
  });

  it('honours a tenant-specific maximum', () => {
    expect(capPunchEnd(OPENED, NOW, 120).getTime()).toBe(OPENED.getTime() + 120 * 60_000);
  });
});

describe('isPunchOverdue', () => {
  it('is false inside the maximum shift', () => {
    expect(isPunchOverdue(OPENED, new Date(OPENED.getTime() + 8 * 3_600_000))).toBe(false);
  });

  it('is true beyond the maximum shift', () => {
    expect(isPunchOverdue(OPENED, NOW)).toBe(true);
  });
});

describe('cappedOpenPunchMinutes', () => {
  it('returns at most the maximum shift', () => {
    expect(cappedOpenPunchMinutes(OPENED, NOW)).toBe(DEFAULT_MAX_SHIFT_MINUTES);
  });
});

describe('describeClockInConflict', () => {
  it('reports NONE when there is no open punch', () => {
    const state = describeClockInConflict(null, NOW);
    expect(state.kind).toBe('NONE');
    expect(state.punch).toBeNull();
    expect(state.suggestedCloseAt).toBeNull();
  });

  it('flags a previous-day open punch with a suggested close time at the cap', () => {
    const state = describeClockInConflict({ id: 'punch_1', clockedInAt: OPENED }, NOW);

    expect(state.kind).toBe('PREVIOUS_DAY');
    expect(state.punch?.previousDay).toBe(true);
    expect(state.punch?.overdue).toBe(true);
    expect(state.punch?.durationMinutes).toBe(DEFAULT_MAX_SHIFT_MINUTES);
    expect(state.punch?.cappedEndAt).toBe(
      new Date(OPENED.getTime() + DEFAULT_MAX_SHIFT_MINUTES * 60_000).toISOString(),
    );
    expect(state.suggestedCloseAt).toBe(state.punch?.cappedEndAt);
  });

  it('suggests now for a previous-day punch that is not yet overdue', () => {
    // Opened 23:50, clock-in attempt 00:10 the next day.
    const opened = new Date(2026, 10, 20, 23, 50, 0, 0);
    const now = new Date(2026, 10, 21, 0, 10, 0, 0);
    const state = describeClockInConflict({ id: 'punch_2', clockedInAt: opened }, now);

    expect(state.kind).toBe('PREVIOUS_DAY');
    expect(state.punch?.overdue).toBe(false);
    expect(state.suggestedCloseAt).toBe(now.toISOString());
  });

  it('keeps a same-day open punch as a same-day conflict', () => {
    const opened = new Date(2026, 10, 21, 8, 0, 0, 0);
    const state = describeClockInConflict({ id: 'punch_3', clockedInAt: opened }, NOW);

    expect(state.kind).toBe('SAME_DAY');
    expect(state.suggestedCloseAt).toBeNull();
  });
});
