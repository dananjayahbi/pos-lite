/**
 * Pure time-clock hour aggregation (ARGUS #352).
 *
 * The staff-detail Time Clock panel used to sum the ten records on the current
 * page to render "Hours This Week/Month". The badges therefore changed when
 * paginating and understated the month. The server now aggregates the full
 * history; this helper owns the arithmetic so it can be tested without Prisma.
 */

import { capPunchEnd } from '@/lib/attendance/openPunch.core';

export interface TimeClockPunchLike {
  clockedInAt: Date;
  clockedOutAt: Date | null;
}

/** Hours for one punch. An open punch is capped at the maximum shift. */
export function punchHours(
  punch: TimeClockPunchLike,
  now: Date,
  maxShiftMinutes: number,
): number {
  const end =
    punch.clockedOutAt ??
    capPunchEnd(punch.clockedInAt, now, maxShiftMinutes);
  return Math.max(0, (end.getTime() - punch.clockedInAt.getTime()) / 3_600_000);
}

export interface TimeClockSummaryInput {
  /** Records covering at least `weekStart` through `now`. */
  records: readonly TimeClockPunchLike[];
  weekStart: Date;
  monthStart: Date;
  now: Date;
  maxShiftMinutes: number;
}

export interface TimeClockSummary {
  hoursThisWeek: number;
  hoursThisMonth: number;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sum the FULL record set into Monday-to-now and month-to-now totals. Both
 * windows are inclusive of their start instant.
 */
export function summarizeTimeClockHours(
  input: TimeClockSummaryInput,
): TimeClockSummary {
  let week = 0;
  let month = 0;

  for (const record of input.records) {
    const startedAt = record.clockedInAt.getTime();
    const hours = punchHours(record, input.now, input.maxShiftMinutes);
    if (startedAt >= input.monthStart.getTime()) month += hours;
    if (startedAt >= input.weekStart.getTime()) week += hours;
  }

  return {
    hoursThisWeek: roundHours(week),
    hoursThisMonth: roundHours(month),
  };
}

/** Monday 00:00 (local) of the week containing `now`. */
export function startOfLocalWeek(now: Date): Date {
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** First day 00:00 (local) of the month containing `now`. */
export function startOfLocalMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}
