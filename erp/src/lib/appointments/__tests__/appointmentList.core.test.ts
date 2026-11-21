import { describe, expect, it } from 'vitest';

import type { AppointmentStatus } from '@/generated/prisma/client';
import {
  compareAppointmentsUpcomingFirst,
  formatAppointmentListDate,
  isUpcomingAppointment,
  type AppointmentListSortable,
} from '@/lib/appointments/appointmentList.core';

const NOW = new Date(2026, 8, 7, 9, 0, 0);

function row(
  id: string,
  status: AppointmentStatus,
  startTime: Date,
): AppointmentListSortable {
  return { id, status, startTime };
}

describe('formatAppointmentListDate', () => {
  it('always includes the year for a dated row', () => {
    expect(formatAppointmentListDate(new Date(2029, 8, 7, 10, 0), NOW)).toContain('2029');
    expect(formatAppointmentListDate(new Date(2034, 5, 25, 10, 0), NOW)).toContain('2034');
  });

  it('uses day-first en-GB dates and 24-hour times (ARGUS #136)', () => {
    const formatted = formatAppointmentListDate(new Date(2029, 8, 7, 10, 0), NOW);

    expect(formatted).toBe('07 Sep 2029, 10:00');
    expect(formatted).not.toContain('AM');
    expect(formatted).not.toContain('PM');
  });

  it('uses relative labels for today and tomorrow', () => {
    expect(formatAppointmentListDate(new Date(2026, 8, 7, 14, 30), NOW)).toBe('Today, 14:30');
    expect(formatAppointmentListDate(new Date(2026, 8, 8, 14, 30), NOW)).toBe('Tomorrow, 14:30');
  });

  it('handles an invalid date', () => {
    expect(formatAppointmentListDate('not-a-date', NOW)).toBe('Unknown date');
  });
});

describe('isUpcomingAppointment', () => {
  it('treats an active future row as upcoming', () => {
    expect(isUpcomingAppointment(row('a', 'SCHEDULED', new Date(2026, 8, 7, 10, 0)), NOW)).toBe(true);
  });

  it('does not treat past or terminal rows as upcoming', () => {
    expect(isUpcomingAppointment(row('a', 'CONFIRMED', new Date(2026, 8, 7, 8, 0)), NOW)).toBe(false);
    expect(isUpcomingAppointment(row('a', 'CANCELLED', new Date(2026, 8, 9, 8, 0)), NOW)).toBe(false);
    expect(isUpcomingAppointment(row('a', 'COMPLETED', new Date(2026, 8, 9, 8, 0)), NOW)).toBe(false);
  });
});

describe('compareAppointmentsUpcomingFirst', () => {
  it('puts the nearest active upcoming row first', () => {
    const later = row('later', 'SCHEDULED', new Date(2026, 8, 8, 12, 0));
    const sooner = row('sooner', 'CONFIRMED', new Date(2026, 8, 7, 11, 0));
    expect([later, sooner].sort((a, b) => compareAppointmentsUpcomingFirst(a, b, NOW))).toEqual([
      sooner,
      later,
    ]);
  });

  it('puts upcoming rows before past/terminal rows', () => {
    const upcoming = row('upcoming', 'SCHEDULED', new Date(2026, 8, 7, 10, 0));
    const past = row('past', 'SCHEDULED', new Date(2026, 8, 1, 10, 0));
    const terminal = row('terminal', 'CANCELLED', new Date(2026, 9, 1, 10, 0));

    expect(
      [past, terminal, upcoming].sort((a, b) => compareAppointmentsUpcomingFirst(a, b, NOW)),
    ).toEqual([upcoming, terminal, past]);
  });

  it('orders past/terminal rows most-recent-first', () => {
    const older = row('older', 'NO_SHOW', new Date(2026, 8, 1, 10, 0));
    const newer = row('newer', 'CANCELLED', new Date(2026, 8, 5, 10, 0));
    expect([older, newer].sort((a, b) => compareAppointmentsUpcomingFirst(a, b, NOW))).toEqual([
      newer,
      older,
    ]);
  });

  it('uses id as a stable tiebreaker', () => {
    const b = row('b', 'SCHEDULED', new Date(2026, 8, 7, 10, 0));
    const a = row('a', 'SCHEDULED', new Date(2026, 8, 7, 10, 0));
    expect([b, a].sort((x, y) => compareAppointmentsUpcomingFirst(x, y, NOW))).toEqual([a, b]);
  });
});
