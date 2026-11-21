import { isFixtureAppointment, type FixtureAppointmentLike } from './fixtures.core';

/**
 * ARGUS #133 — calendar readability and slot prefill.
 *
 * The month grid rendered every row for a day, so the live tenant's cancelled
 * QA fixtures filled the preview and the status dots. These rules are pure so
 * the calendar UI and its tests agree on what is worth showing.
 */
export interface CalendarAppointmentLike extends FixtureAppointmentLike {
  id: string;
  status: string;
  startTime: string | Date;
}

export interface MonthDaySelection<T extends CalendarAppointmentLike> {
  /** Bookings that may occupy a day cell: no fixtures and no cancellations. */
  visible: T[];
  /** Cancelled/fixture rows collapsed behind the "+N hidden" marker. */
  hiddenCount: number;
}

export function selectMonthViewAppointments<T extends CalendarAppointmentLike>(
  appointments: readonly T[],
): MonthDaySelection<T> {
  const visible: T[] = [];
  let hiddenCount = 0;

  for (const appointment of appointments) {
    if (appointment.status === 'CANCELLED' || isFixtureAppointment(appointment)) {
      hiddenCount += 1;
      continue;
    }
    visible.push(appointment);
  }

  return { visible, hiddenCount };
}

export interface AppointmentSlotDefaults {
  [key: string]: string;
  startTime: string;
  endTime: string;
}

/**
 * Prefill for a new booking opened from a calendar slot. The clicked instant is
 * the start; the end follows the form's default duration.
 */
export function appointmentSlotDefaults(
  clicked: Date,
  durationMins = 30,
): AppointmentSlotDefaults {
  const start = new Date(clicked);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMins);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}
