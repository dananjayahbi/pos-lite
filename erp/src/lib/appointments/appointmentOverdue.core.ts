import type { AppointmentStatus } from '@/generated/prisma/client';

/**
 * ARGUS #126 — overdue appointments are a DERIVED state, never a stored one.
 *
 * Four SCHEDULED bookings from 29 Oct were still sitting in SCHEDULED on 20 Nov
 * with no warning and no automatic no-show. Reading a page must not rewrite
 * history, so an active booking becomes OVERDUE for display/filtering once its
 * start time is more than the grace window in the past. Resolving it is an
 * explicit operator action (Mark no-show, or a late check-in).
 */
export const APPOINTMENT_OVERDUE_GRACE_MINUTES = 15;

/** Only states that still expect the customer to arrive can become overdue. */
export const APPOINTMENT_OVERDUE_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const;

export type AppointmentOverdueStatus = (typeof APPOINTMENT_OVERDUE_STATUSES)[number];
export type AppointmentDisplayStatus = AppointmentStatus | 'OVERDUE';

export interface AppointmentOverdueSubject {
  status: AppointmentStatus;
  startTime: string | Date;
}

export interface AppointmentOverdueOptions {
  /** Injectable clock for tests and deterministic callers. */
  now?: Date;
  graceMinutes?: number;
}

/** The instant at or before which an active booking is considered overdue. */
export function appointmentOverdueCutoff(
  options: AppointmentOverdueOptions = {},
): Date {
  const now = options.now ?? new Date();
  const graceMinutes = options.graceMinutes ?? APPOINTMENT_OVERDUE_GRACE_MINUTES;
  return new Date(now.getTime() - Math.max(graceMinutes, 0) * 60_000);
}

export function isAppointmentOverdue(
  subject: AppointmentOverdueSubject,
  options: AppointmentOverdueOptions = {},
): boolean {
  if (!APPOINTMENT_OVERDUE_STATUSES.includes(subject.status as AppointmentOverdueStatus)) {
    return false;
  }

  const start = subject.startTime instanceof Date ? subject.startTime : new Date(subject.startTime);
  if (Number.isNaN(start.getTime())) return false;

  return start.getTime() < appointmentOverdueCutoff(options).getTime();
}

export function appointmentDisplayStatus(
  subject: AppointmentOverdueSubject,
  options: AppointmentOverdueOptions = {},
): AppointmentDisplayStatus {
  return isAppointmentOverdue(subject, options) ? 'OVERDUE' : subject.status;
}
