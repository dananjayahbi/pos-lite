import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ATTENDANCE_CALENDAR,
  buildAttendanceCalendarRows,
  countNoPayDays,
  deriveAttendanceStatus,
  enumerateDateRange,
  isWorkingDay,
  normalizeAttendanceCalendar,
  parseAttendanceCalendar,
  type AttendanceCalendarSettings,
} from '@/lib/attendance/attendanceCalendar.core';
import { deriveNoPayDays } from '@/lib/payroll/calculations';

/**
 * ARGUS #348 — weekends/holidays must never be Absent, future days must not be
 * Absent, and the monthly report must agree with the daily view.
 */

// 2026-11-16 is a Monday.
const MONDAY = '2026-11-16';
const SATURDAY = '2026-11-21';
const SUNDAY = '2026-11-22';
const TODAY = '2026-11-20'; // Friday

const MON_FRI: AttendanceCalendarSettings = {
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
  fullDayMinutes: 480,
  halfDayMinutes: 240,
};

function status(
  date: string,
  overrides: {
    hasPunches?: boolean;
    workedMinutes?: number;
    override?: Parameters<typeof deriveAttendanceStatus>[0]['override'];
    calendar?: AttendanceCalendarSettings;
    today?: string;
    employedFrom?: string | null | undefined;
  } = {},
) {
  return deriveAttendanceStatus({
    date,
    today: overrides.today ?? TODAY,
    hasPunches: overrides.hasPunches ?? false,
    workedMinutes: overrides.workedMinutes,
    override: overrides.override ?? null,
    calendar: overrides.calendar ?? MON_FRI,
    employedFrom: overrides.employedFrom,
  });
}

describe('parseAttendanceCalendar', () => {
  it('defaults to Mon-Fri with no holidays', () => {
    expect(parseAttendanceCalendar(null)).toEqual(DEFAULT_ATTENDANCE_CALENDAR);
    expect(parseAttendanceCalendar({})).toEqual(DEFAULT_ATTENDANCE_CALENDAR);
    expect(parseAttendanceCalendar({ attendance: {} })).toEqual(DEFAULT_ATTENDANCE_CALENDAR);
  });

  it('reads configured working days and holidays', () => {
    expect(
      parseAttendanceCalendar({
        attendance: { workingDays: [6, 1, 2, 3, 4, 5], holidays: ['2026-12-25', '2026-04-13'] },
      }),
    ).toEqual({
      workingDays: [1, 2, 3, 4, 5, 6],
      holidays: ['2026-04-13', '2026-12-25'],
      fullDayMinutes: 480,
      halfDayMinutes: 240,
    });
  });

  it('reads configurable full/half-day thresholds', () => {
    expect(
      parseAttendanceCalendar({
        attendance: { workingDays: [1], holidays: [], fullDayMinutes: 420, halfDayMinutes: 180 },
      }),
    ).toMatchObject({ fullDayMinutes: 420, halfDayMinutes: 180 });
  });

  it('keeps the half-day threshold below the full-day threshold', () => {
    expect(
      parseAttendanceCalendar({
        attendance: { workingDays: [1], fullDayMinutes: 300, halfDayMinutes: 400 },
      }),
    ).toMatchObject({ fullDayMinutes: 300, halfDayMinutes: 150 });
  });

  it('drops invalid weekdays/holidays and falls back for an empty working week', () => {
    expect(
      parseAttendanceCalendar({
        attendance: { workingDays: [0, 8, '2', 'x'], holidays: ['25-12-2026', '2026-12-25'] },
      }),
    ).toMatchObject({ workingDays: [2], holidays: ['2026-12-25'] });

    expect(
      parseAttendanceCalendar({ attendance: { workingDays: [0, 9], holidays: [] } }),
    ).toEqual(DEFAULT_ATTENDANCE_CALENDAR);
  });

  it('normalizes a submitted calendar', () => {
    expect(
      normalizeAttendanceCalendar({ workingDays: [7, 7, 3], holidays: ['2026-01-01', 'bad'] }),
    ).toMatchObject({ workingDays: [3, 7], holidays: ['2026-01-01'] });
  });
});

describe('working day + holiday calendar', () => {
  it('treats Mon-Fri as working and the weekend as off', () => {
    expect(isWorkingDay(MONDAY, MON_FRI)).toBe(true);
    expect(isWorkingDay('2026-11-19', MON_FRI)).toBe(true);
    expect(isWorkingDay(SATURDAY, MON_FRI)).toBe(false);
    expect(isWorkingDay(SUNDAY, MON_FRI)).toBe(false);
  });

  it('treats a tenant that works Saturdays', () => {
    const monSat = { ...MON_FRI, workingDays: [1, 2, 3, 4, 5, 6] };
    expect(isWorkingDay(SATURDAY, monSat)).toBe(true);
    expect(isWorkingDay(SUNDAY, monSat)).toBe(false);
  });

  it('treats a configured holiday as non-working', () => {
    const calendar = { ...MON_FRI, holidays: [MONDAY] };
    expect(status(MONDAY, { calendar })).toBe('HOLIDAY');
  });
});

describe('deriveAttendanceStatus', () => {
  it('marks a past working day with no punch absent', () => {
    expect(status(MONDAY)).toBe('ABSENT');
  });

  it('marks a full working day with a punch present', () => {
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 480 })).toBe('PRESENT');
  });

  it('never marks weekends absent', () => {
    expect(status(SATURDAY)).toBe('OFF');
    expect(status(SUNDAY)).toBe('OFF');
  });

  it('grades a weekend someone actually worked by hours', () => {
    const pastSaturday = '2026-11-14'; // Saturday before TODAY
    expect(status(pastSaturday, { hasPunches: true, workedMinutes: 4 })).toBe('INSUFFICIENT');
    expect(status(pastSaturday, { hasPunches: true, workedMinutes: 480 })).toBe('PRESENT');
  });

  it('never marks future working days absent', () => {
    expect(status('2026-11-23')).toBe('SCHEDULED');
  });

  it('keeps future weekends off rather than absent', () => {
    expect(status('2026-11-28')).toBe('OFF');
  });

  it('treats explicit overrides as authoritative, even on a weekend/future', () => {
    expect(status(SATURDAY, { override: 'ABSENT' })).toBe('ABSENT');
    expect(status('2026-11-23', { override: 'LEAVE' })).toBe('LEAVE');
    expect(status(MONDAY, { hasPunches: true, override: 'HALF_DAY' })).toBe('HALF_DAY');
  });

  it('marks days before employment as off, not absent', () => {
    expect(status(MONDAY, { employedFrom: '2026-11-18' })).toBe('OFF');
    expect(status('2026-11-19', { employedFrom: '2026-11-18' })).toBe('ABSENT');
  });
});

describe('buildAttendanceCalendarRows', () => {
  // Mon 16 … Sun 22 Nov 2026, evaluated after the week so the weekend is in the
  // past. Punches on Monday and Tuesday only.
  const WEEK_TODAY = '2026-11-23';
  const week = buildAttendanceCalendarRows({
    from: MONDAY,
    to: SUNDAY,
    today: WEEK_TODAY,
    calendar: MON_FRI,
    punchDates: new Set([MONDAY, '2026-11-17']),
    workedMinutesByDate: new Map([
      [MONDAY, 480],
      ['2026-11-17', 480],
    ]),
  });

  it('emits every day of the range (weekends as OFF)', () => {
    expect(week.rows).toHaveLength(7);
    expect(week.rows.map((row) => row.date)).toEqual(enumerateDateRange(MONDAY, SUNDAY));
  });

  it('matches the daily derivation for every date', () => {
    for (const row of week.rows) {
      expect(row.status).toBe(
        deriveAttendanceStatus({
          date: row.date,
          today: WEEK_TODAY,
          hasPunches: row.hasPunches,
          workedMinutes: row.hasPunches ? 480 : 0,
          calendar: MON_FRI,
        }),
      );
    }
  });

  it('counts two present, three absent and the weekend as off', () => {
    expect(week.counts).toEqual({
      present: 2,
      absent: 3,
      insufficient: 0,
      leave: 0,
      halfDay: 0,
      holiday: 0,
      off: 2,
      scheduled: 0,
    });
  });

  it('omits future days unless they have an override', () => {
    const current = buildAttendanceCalendarRows({
      from: '2026-11-19',
      to: '2026-11-30',
      today: TODAY,
      calendar: MON_FRI,
      punchDates: new Set(['2026-11-19']),
      overrides: new Map([['2026-11-25', 'LEAVE' as const]]),
    });

    const dates = current.rows.map((row) => row.date);
    expect(dates).toContain('2026-11-20');
    expect(dates).not.toContain('2026-11-21'); // future Saturday
    expect(dates).not.toContain('2026-11-23'); // future Monday
    expect(dates).toContain('2026-11-25'); // explicit future override
    expect(current.counts.scheduled).toBe(0);
  });

  it('counts a configured holiday as holiday and not absent', () => {
    const calendar = { ...MON_FRI, holidays: ['2026-11-17'] };
    const result = buildAttendanceCalendarRows({
      from: MONDAY,
      to: '2026-11-18',
      today: TODAY,
      calendar,
      punchDates: new Set([MONDAY]),
      workedMinutesByDate: new Map([[MONDAY, 480]]),
    });

    expect(result.rows.map((row) => row.status)).toEqual(['PRESENT', 'HOLIDAY', 'ABSENT']);
    expect(result.counts.holiday).toBe(1);
    expect(result.counts.absent).toBe(1);
  });

  it('matches the daily absent count for a no-punch month segment', () => {
    // The live defect: a month with no punches must not report 0 absences.
    const monthStart = '2026-11-02';
    const result = buildAttendanceCalendarRows({
      from: monthStart,
      to: TODAY,
      today: TODAY,
      calendar: MON_FRI,
      punchDates: new Set(),
    });

    expect(result.counts.present).toBe(0);
    expect(result.counts.absent).toBeGreaterThan(0);
    expect(result.counts.off).toBeGreaterThan(0); // weekends
  });
});

/**
 * ARGUS #350 — any punch (even 0 minutes) used to count as a full Present day.
 * Past days are now graded by worked minutes; today stays provisional.
 */
describe('hour-based status (ARGUS #350)', () => {
  it('does not count a zero-minute punch as Present', () => {
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 0 })).toBe('INSUFFICIENT');
  });

  it('treats a day below the half-day threshold as insufficient hours', () => {
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 4 })).toBe('INSUFFICIENT');
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 239 })).toBe('INSUFFICIENT');
  });

  it('marks exactly the half-day threshold as Half Day', () => {
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 240 })).toBe('HALF_DAY');
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 479 })).toBe('HALF_DAY');
  });

  it('marks exactly the full-day threshold as Present', () => {
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 480 })).toBe('PRESENT');
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 600 })).toBe('PRESENT');
  });

  it('keeps an explicit override authoritative over the hours', () => {
    expect(
      status(MONDAY, { hasPunches: true, workedMinutes: 4, override: 'PRESENT' }),
    ).toBe('PRESENT');
    expect(
      status(MONDAY, { hasPunches: true, workedMinutes: 600, override: 'HALF_DAY' }),
    ).toBe('HALF_DAY');
  });

  it('keeps today provisional so an early clock-in is not penalised', () => {
    expect(
      status(TODAY, { hasPunches: true, workedMinutes: 30, today: TODAY }),
    ).toBe('PRESENT');
  });

  it('honours tenant-configured thresholds', () => {
    const calendar = { ...MON_FRI, fullDayMinutes: 420, halfDayMinutes: 180 };
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 180, calendar })).toBe('HALF_DAY');
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 200, calendar })).toBe('HALF_DAY');
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 420, calendar })).toBe('PRESENT');
    expect(status(MONDAY, { hasPunches: true, workedMinutes: 179, calendar })).toBe('INSUFFICIENT');
  });
});

describe('payroll consistency (ARGUS #350)', () => {
  it('counts insufficient-hours days as no-pay days alongside true absences', () => {
    const weekStart = '2026-11-16';
    const result = buildAttendanceCalendarRows({
      from: weekStart,
      to: '2026-11-20',
      today: '2026-11-23',
      calendar: MON_FRI,
      punchDates: new Set(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-20']),
      workedMinutesByDate: new Map([
        ['2026-11-16', 480], // full
        ['2026-11-17', 240], // half
        ['2026-11-18', 0], // punched but zero minutes
        ['2026-11-20', 100], // below half
        // Thursday: no punch at all
      ]),
    });

    expect(result.counts).toEqual({
      present: 1,
      absent: 1,
      insufficient: 2,
      leave: 0,
      halfDay: 1,
      holiday: 0,
      off: 0,
      scheduled: 0,
    });
    expect(countNoPayDays(result.counts)).toBe(3);
    // Payroll deducts absent + 0.5 × half-day = 3.5 days.
    expect(deriveNoPayDays(countNoPayDays(result.counts), result.counts.halfDay).toNumber()).toBe(
      3.5,
    );
  });
});
