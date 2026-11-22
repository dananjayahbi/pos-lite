import { formatAttendanceYmd } from '@/lib/attendance/attendanceCalendar.core';

/**
 * Manual clock-punch validation (ARGUS #349).
 *
 * A forgotten punch must be addable from the attendance page, but a manual
 * entry has to obey the same physical rules as the live clock: clock-out after
 * clock-in, nothing in the future, no overlap with another punch for the same
 * staff member, and an open punch only for today (a past day needs a real
 * clock-out, otherwise the open interval would count every hour since).
 */

export interface PunchTimes {
  clockedInAt: Date;
  clockedOutAt: Date | null;
}

export interface ExistingPunch extends PunchTimes {
  id: string;
}

export interface PunchValidationError {
  field: 'clockedInAt' | 'clockedOutAt';
  message: string;
}

export function validatePunchTimes(
  candidate: PunchTimes,
  now: Date = new Date(),
): PunchValidationError | null {
  if (Number.isNaN(candidate.clockedInAt.getTime())) {
    return { field: 'clockedInAt', message: 'Enter a valid clock-in time' };
  }
  if (candidate.clockedOutAt && Number.isNaN(candidate.clockedOutAt.getTime())) {
    return { field: 'clockedOutAt', message: 'Enter a valid clock-out time' };
  }

  if (candidate.clockedInAt.getTime() > now.getTime()) {
    return { field: 'clockedInAt', message: 'Clock-in cannot be in the future' };
  }

  if (
    candidate.clockedOutAt &&
    candidate.clockedOutAt.getTime() <= candidate.clockedInAt.getTime()
  ) {
    return { field: 'clockedOutAt', message: 'Clock-out must be after clock-in' };
  }

  if (candidate.clockedOutAt && candidate.clockedOutAt.getTime() > now.getTime()) {
    return { field: 'clockedOutAt', message: 'Clock-out cannot be in the future' };
  }

  // An open punch on a past day would accrue every hour since then as worked
  // time, so require the real end time outside today.
  if (
    !candidate.clockedOutAt &&
    formatAttendanceYmd(candidate.clockedInAt) !== formatAttendanceYmd(now)
  ) {
    return {
      field: 'clockedOutAt',
      message: 'A punch on a past day needs a clock-out time',
    };
  }

  return null;
}

/** Open intervals extend to `now`, so they overlap any later punch. */
function effectiveEnd(punch: PunchTimes, now: Date): Date {
  return punch.clockedOutAt ?? now;
}

export function punchOverlaps(
  candidate: PunchTimes,
  existing: PunchTimes,
  now: Date = new Date(),
): boolean {
  const candidateEnd = effectiveEnd(candidate, now);
  const existingEnd = effectiveEnd(existing, now);
  return (
    candidate.clockedInAt.getTime() < existingEnd.getTime() &&
    existing.clockedInAt.getTime() < candidateEnd.getTime()
  );
}

export function findOverlappingPunch(
  candidate: PunchTimes,
  existing: readonly ExistingPunch[],
  now: Date = new Date(),
): ExistingPunch | null {
  for (const punch of existing) {
    if (punchOverlaps(candidate, punch, now)) return punch;
  }
  return null;
}
