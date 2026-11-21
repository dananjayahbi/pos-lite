import type { AppointmentStatus } from '@/generated/prisma/client';
import { formatAppointmentRelativeDate } from './appointmentDisplay.core';

/**
 * ARGUS #129 — list formatting and ordering.
 *
 * Dates used to render as "Sep 7"/"Jun 25" even for 2029/2034 rows, and the
 * list sorted oldest-first, so page 1 was dominated by ancient cancelled QA
 * records. Both rules are pure so the API order and the UI copy are testable.
 */
export const APPOINTMENT_OPEN_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
] as const;

export interface AppointmentListSortable {
  id: string;
  status: AppointmentStatus;
  startTime: string | Date;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * "Today, 10:00", "Tomorrow, 14:30", otherwise "07 Sep 2029, 10:00" — the
 * year is never omitted for a dated row. ARGUS #136 switched this from the
 * old en-US month-first 12-hour copy to the app's en-GB convention.
 */
export function formatAppointmentListDate(
  value: string | Date,
  now: Date = new Date(),
): string {
  return formatAppointmentRelativeDate(value, now);
}

/** An active booking at or after `now` belongs to the upcoming bucket. */
export function isUpcomingAppointment(
  appointment: AppointmentListSortable,
  now: Date = new Date(),
): boolean {
  if (!APPOINTMENT_OPEN_STATUSES.includes(appointment.status as (typeof APPOINTMENT_OPEN_STATUSES)[number])) {
    return false;
  }
  const start = toDate(appointment.startTime);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() >= now.getTime();
}

/**
 * Upcoming-first ordering:
 *  1. active appointments at/after now, nearest first;
 *  2. everything else (past/terminal), most recent first;
 *  3. id ascending as a stable tiebreaker.
 */
export function compareAppointmentsUpcomingFirst(
  a: AppointmentListSortable,
  b: AppointmentListSortable,
  now: Date = new Date(),
): number {
  const aUpcoming = isUpcomingAppointment(a, now);
  const bUpcoming = isUpcomingAppointment(b, now);
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

  const aTime = toDate(a.startTime).getTime();
  const bTime = toDate(b.startTime).getTime();
  if (aTime !== bTime) {
    return aUpcoming ? aTime - bTime : bTime - aTime;
  }
  return a.id.localeCompare(b.id);
}
