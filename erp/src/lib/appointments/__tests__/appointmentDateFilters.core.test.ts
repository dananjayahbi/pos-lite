import { describe, expect, it } from 'vitest';

import {
  parseAppointmentDateEnd,
  parseAppointmentDateStart,
} from '@/lib/appointments/appointmentDateFilters.core';

describe('parseAppointmentDateStart / End', () => {
  it('expands a date-only start to local midnight', () => {
    const start = parseAppointmentDateStart('2026-10-29');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(29);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('expands a date-only end to the local end of day', () => {
    const end = parseAppointmentDateEnd('2026-10-29');
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(9);
    expect(end.getDate()).toBe(29);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('includes a local 03:00 appointment on the boundary day', () => {
    const start = parseAppointmentDateStart('2026-10-29');
    const end = parseAppointmentDateEnd('2026-10-29');
    const earlyMorning = new Date(2026, 9, 29, 3, 0, 0);

    expect(earlyMorning >= start).toBe(true);
    expect(earlyMorning <= end).toBe(true);
  });

  it('does not leak into the previous local day', () => {
    const start = parseAppointmentDateStart('2026-10-29');
    const previousDayEnd = new Date(2026, 9, 28, 23, 59, 59, 999);
    expect(previousDayEnd < start).toBe(true);
  });

  it('preserves full timestamps used by calendar callers', () => {
    const iso = '2026-10-29T04:30:00.000Z';
    expect(parseAppointmentDateStart(iso).toISOString()).toBe(iso);
    expect(parseAppointmentDateEnd(iso).toISOString()).toBe(iso);
  });
});
