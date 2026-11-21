import type { AppointmentStatus } from '@/generated/prisma/client';

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

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * "Today, 10:00 AM", "Tomorrow, 2:30 PM", otherwise
 * "Sep 7, 2029, 10:00 AM" — the year is never omitted for a dated row.
 */
export function formatAppointmentListDate(
  value: string | Date,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  const time = formatTime(date);
  if (sameLocalDay(date, now)) return `Today, ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameLocalDay(date, tomorrow)) return `Tomorrow, ${time}`;

  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${time}`;
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
