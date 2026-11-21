import { describe, expect, it } from 'vitest';

import { appointmentLocalDayRange } from '@/lib/appointments/appointmentStats.core';

describe('appointmentLocalDayRange', () => {
  it('starts and ends on local midnight boundaries', () => {
    const now = new Date(2026, 8, 7, 14, 30, 15, 250);
    const { dateFrom, dateTo } = appointmentLocalDayRange(now);

    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(7);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(8);
    expect(end.getDate()).toBe(7);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('is stable for any time of the same local day', () => {
    const morning = appointmentLocalDayRange(new Date(2026, 8, 7, 0, 0, 0, 0));
    const evening = appointmentLocalDayRange(new Date(2026, 8, 7, 23, 59, 59, 999));

    expect(morning).toEqual(evening);
  });

  it('moves with the local calendar day', () => {
    const first = appointmentLocalDayRange(new Date(2026, 8, 7, 12, 0));
    const second = appointmentLocalDayRange(new Date(2026, 8, 8, 12, 0));

    expect(new Date(second.dateFrom).getTime()).toBeGreaterThan(
      new Date(first.dateFrom).getTime(),
    );
  });
});
