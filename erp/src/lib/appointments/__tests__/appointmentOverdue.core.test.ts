import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_OVERDUE_GRACE_MINUTES,
  appointmentDisplayStatus,
  appointmentOverdueCutoff,
  isAppointmentOverdue,
} from '@/lib/appointments/appointmentOverdue.core';

const NOW = new Date('2026-11-20T12:00:00.000Z');
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();
const minutesLater = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000).toISOString();

describe('isAppointmentOverdue', () => {
  it('marks an active booking overdue only after the grace window', () => {
    expect(
      isAppointmentOverdue(
        { status: 'SCHEDULED', startTime: minutesAgo(APPOINTMENT_OVERDUE_GRACE_MINUTES + 1) },
        { now: NOW },
      ),
    ).toBe(true);
    expect(
      isAppointmentOverdue(
        { status: 'CONFIRMED', startTime: minutesAgo(APPOINTMENT_OVERDUE_GRACE_MINUTES + 1) },
        { now: NOW },
      ),
    ).toBe(true);
  });

  it('does not flag a booking inside the grace window or in the future', () => {
    expect(
      isAppointmentOverdue(
        { status: 'SCHEDULED', startTime: minutesAgo(APPOINTMENT_OVERDUE_GRACE_MINUTES) },
        { now: NOW },
      ),
    ).toBe(false);
    expect(
      isAppointmentOverdue({ status: 'CONFIRMED', startTime: minutesLater(5) }, { now: NOW }),
    ).toBe(false);
  });

  it('never flags terminal or already-started states', () => {
    for (const status of ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const) {
      expect(isAppointmentOverdue({ status, startTime: minutesAgo(600) }, { now: NOW })).toBe(
        false,
      );
    }
  });

  it('treats an unparseable start time as not overdue', () => {
    expect(isAppointmentOverdue({ status: 'SCHEDULED', startTime: 'not-a-date' }, { now: NOW })).toBe(
      false,
    );
  });

  it('supports a caller-supplied grace period', () => {
    expect(
      isAppointmentOverdue(
        { status: 'SCHEDULED', startTime: minutesAgo(10) },
        { now: NOW, graceMinutes: 5 },
      ),
    ).toBe(true);
  });
});

describe('appointmentDisplayStatus', () => {
  it('returns OVERDUE for display without changing the stored status', () => {
    const subject = { status: 'SCHEDULED' as const, startTime: minutesAgo(120) };
    expect(appointmentDisplayStatus(subject, { now: NOW })).toBe('OVERDUE');
    expect(subject.status).toBe('SCHEDULED');
  });

  it('returns the underlying status when not overdue', () => {
    expect(
      appointmentDisplayStatus({ status: 'CONFIRMED', startTime: minutesLater(30) }, { now: NOW }),
    ).toBe('CONFIRMED');
  });
});

describe('appointmentOverdueCutoff', () => {
  it('subtracts the default grace window from the supplied clock', () => {
    expect(appointmentOverdueCutoff({ now: NOW }).toISOString()).toBe(
      '2026-11-20T11:45:00.000Z',
    );
  });
});
