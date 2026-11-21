/**
 * ARGUS #136 — the appointment screens used `en-US` month-first, 12-hour dates
 * while the rest of the ERP is `en-GB` day-first. These helpers are the single
 * source for appointment date/time copy.
 */
export interface AppointmentDateFormatOptions {
  weekday?: boolean;
  /** Defaults to short ("Sep"); the detail/calendar headers use long. */
  month?: 'short' | 'long';
  /** Defaults to true; week ranges and relative labels can omit the year. */
  year?: boolean;
}

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const MONTHS_SHORT = [
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

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** `07 Sep 2026`, or `Monday, 07 September 2026` with weekday + long month. */
export function formatAppointmentDate(
  value: string | Date,
  options: AppointmentDateFormatOptions = {},
): string {
  const date = toDate(value);
  if (!date) return 'Unknown date';

  const parts: string[] = [];
  if (options.weekday) parts.push(`${WEEKDAYS_LONG[date.getDay()]},`);
  parts.push(String(date.getDate()).padStart(2, '0'));
  parts.push(options.month === 'long' ? MONTHS_LONG[date.getMonth()]! : MONTHS_SHORT[date.getMonth()]!);
  if (options.year !== false) parts.push(String(date.getFullYear()));

  return parts.join(' ');
}

/** `September 2026` — the month-view header. */
export function formatAppointmentMonthYear(value: string | Date): string {
  const date = toDate(value);
  if (!date) return 'Unknown date';
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** `09:30` — 24-hour, matching en-GB elsewhere in the ERP. */export function formatAppointmentTime(value: string | Date): string {
  const date = toDate(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatAppointmentTimeRange(start: string | Date, end: string | Date): string {
  return `${formatAppointmentTime(start)} - ${formatAppointmentTime(end)}`;
}

/** `07 Sep 2026, 09:30` — day-first, 24-hour. */
export function formatAppointmentDateTime(value: string | Date): string {
  const date = toDate(value);
  if (!date) return 'Unknown date';
  return `${formatAppointmentDate(date)}, ${formatAppointmentTime(date)}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `Today, 09:30`, `Tomorrow, 14:00`, otherwise `07 Sep 2026, 10:00`. */
export function formatAppointmentRelativeDate(
  value: string | Date,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return 'Unknown date';

  const time = formatAppointmentTime(date);
  if (sameDay(date, now)) return `Today, ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(date, tomorrow)) return `Tomorrow, ${time}`;

  return `${formatAppointmentDate(date)}, ${time}`;
}

export interface AppointmentCustomerFields {
  title?: string | null | undefined;
  customerName?: string | null | undefined;
  walkInName?: string | null | undefined;
}

/**
 * The customer column and calendar card should not echo the appointment title
 * when a walk-in booking's title is the walk-in name. Returns null in that
 * case so the caller can fall back to "Walk-in" (or hide the row).
 */
export function appointmentCustomerLabel(
  appointment: AppointmentCustomerFields,
): string | null {
  const customer = appointment.customerName?.trim();
  if (customer) return customer;

  const walkIn = appointment.walkInName?.trim();
  if (!walkIn) return null;

  const title = appointment.title?.trim();
  if (title && title.toLowerCase() === walkIn.toLowerCase()) return null;

  return walkIn;
}
