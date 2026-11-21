/**
 * ARGUS #127 — staff availability is enforced when a booking is written.
 *
 * The create/update API accepted any date and time; four bookings landed on
 * Thursday/Sunday while the only availability was Wednesday 09:00–17:00. This
 * pure helper is shared by the service (authoritative 422) and the form
 * (advisory inline warning) so both read the same rules.
 */
export type AppointmentAvailabilityIssueCode =
  | 'NO_AVAILABILITY'
  | 'OUTSIDE_AVAILABILITY'
  | 'TIME_OFF'
  | 'BLOCKED_SLOT';

export interface AppointmentAvailabilityIssue {
  code: AppointmentAvailabilityIssueCode;
  message: string;
}

export const APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES: Record<
  AppointmentAvailabilityIssueCode,
  string
> = {
  NO_AVAILABILITY: 'The staff member has no availability on this day',
  OUTSIDE_AVAILABILITY: 'The selected time is outside the staff member\'s available hours',
  TIME_OFF: 'The staff member is on approved time off for the selected slot',
  BLOCKED_SLOT: 'The selected slot is blocked',
};

export interface AppointmentAvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean | null;
}

export interface AppointmentTimeOffWindow {
  date: string | Date;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  isApproved?: boolean | null;
}

export interface AppointmentBlockedSlot {
  startTime: string | Date;
  endTime: string | Date;
}

export interface AppointmentAvailabilityInput {
  startTime: string | Date;
  endTime: string | Date;
  availability: readonly AppointmentAvailabilityWindow[];
  timeOff?: readonly AppointmentTimeOffWindow[];
  blockedSlots?: readonly AppointmentBlockedSlot[];
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toMinutes(time: string): number | null {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function timeOffBlocks(
  block: AppointmentTimeOffWindow,
  start: Date,
  end: Date,
): boolean {
  if (block.isApproved === false) return false;
  const blockDate = toDate(block.date);
  if (!sameLocalDay(blockDate, start)) return false;

  // No window (or a half-open window) means the whole day is blocked.
  if (!block.startTime || !block.endTime) return true;

  const blockStart = toDate(block.startTime);
  const blockEnd = toDate(block.endTime);
  if (Number.isNaN(blockStart.getTime()) || Number.isNaN(blockEnd.getTime())) {
    return true;
  }
  return blockStart.getTime() < end.getTime() && blockEnd.getTime() > start.getTime();
}

export function appointmentAvailabilityIssue(
  input: AppointmentAvailabilityInput,
): AppointmentAvailabilityIssue | null {
  const start = toDate(input.startTime);
  const end = toDate(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      code: 'OUTSIDE_AVAILABILITY',
      message: APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES.OUTSIDE_AVAILABILITY,
    };
  }

  const dayOfWeek = start.getDay();
  const dayWindows = input.availability.filter(
    (window) => window.dayOfWeek === dayOfWeek && window.isAvailable !== false,
  );

  if (dayWindows.length === 0) {
    return {
      code: 'NO_AVAILABILITY',
      message: APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES.NO_AVAILABILITY,
    };
  }

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const sameDay = sameLocalDay(start, end);
  const insideWindow =
    sameDay &&
    dayWindows.some((window) => {
      const windowStart = toMinutes(window.startTime);
      const windowEnd = toMinutes(window.endTime);
      if (windowStart === null || windowEnd === null) return false;
      return windowStart <= startMinutes && endMinutes <= windowEnd;
    });

  if (!insideWindow) {
    return {
      code: 'OUTSIDE_AVAILABILITY',
      message: APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES.OUTSIDE_AVAILABILITY,
    };
  }

  if (
    (input.timeOff ?? []).some((block) => timeOffBlocks(block, start, end))
  ) {
    return {
      code: 'TIME_OFF',
      message: APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES.TIME_OFF,
    };
  }

  const blocked = (input.blockedSlots ?? []).some((slot) => {
    const slotStart = toDate(slot.startTime);
    const slotEnd = toDate(slot.endTime);
    if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) {
      return false;
    }
    return slotStart.getTime() < end.getTime() && slotEnd.getTime() > start.getTime();
  });

  if (blocked) {
    return {
      code: 'BLOCKED_SLOT',
      message: APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES.BLOCKED_SLOT,
    };
  }

  return null;
}
