/**
 * One attendance calendar shared by the daily view, the monthly attendance
 * report/CSV and the payslip (ARGUS #348).
 *
 * Before this module the daily table derived ABSENT for every active staff
 * member with no punch — including weekends and public holidays — while the
 * monthly report emitted only days with a punch or an explicit override, so
 * payroll saw no absences at all. The rules here are pure and shared:
 *
 * - a working weekday with no punch and no override is ABSENT;
 * - a weekend, a configured holiday or a day before the person was employed is
 *   never ABSENT (HOLIDAY for a configured holiday, OFF otherwise);
 * - a future working day is SCHEDULED, never ABSENT;
 * - an explicit AttendanceDay override always wins.
 *
 * The calendar lives in the tenant settings JSON (`settings.attendance`):
 *   { "attendance": { "workingDays": [1,2,3,4,5], "holidays": ["2026-12-25"] } }
 * No schema change is involved.
 */

export type AttendanceDisplayStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LEAVE'
  | 'HALF_DAY'
  | 'HOLIDAY'
  | 'OFF'
  | 'SCHEDULED';

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const ALL_ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Mon–Fri by default, matching the payroll module's calendar weekday base. */
export const DEFAULT_ATTENDANCE_WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5];

export interface AttendanceCalendarSettings {
  workingDays: number[];
  /** YYYY-MM-DD dates treated as public/company holidays. */
  holidays: string[];
}

export const DEFAULT_ATTENDANCE_CALENDAR: AttendanceCalendarSettings = {
  workingDays: [...DEFAULT_ATTENDANCE_WORKING_DAYS],
  holidays: [],
};

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWorkingDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_ATTENDANCE_CALENDAR.workingDays];
  const days = new Set<number>();
  for (const entry of value) {
    const day = typeof entry === 'number' ? entry : Number.parseInt(String(entry), 10);
    if (Number.isInteger(day) && day >= 1 && day <= 7) days.add(day);
  }
  if (days.size === 0) return [...DEFAULT_ATTENDANCE_CALENDAR.workingDays];
  return [...days].sort((a, b) => a - b);
}

function normalizeHolidays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const dates = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && YMD_PATTERN.test(entry)) dates.add(entry);
  }
  return [...dates].sort();
}

/** Read `settings.attendance`; corrupt/partial blobs fall back per-field. */
export function parseAttendanceCalendar(settings: unknown): AttendanceCalendarSettings {
  if (!isRecord(settings)) return { ...DEFAULT_ATTENDANCE_CALENDAR };
  const attendance = settings.attendance;
  if (!isRecord(attendance)) return { ...DEFAULT_ATTENDANCE_CALENDAR };

  return {
    workingDays: normalizeWorkingDays(attendance.workingDays),
    holidays: normalizeHolidays(attendance.holidays),
  };
}

/** Clamp a submitted calendar into the storable full shape. */
export function normalizeAttendanceCalendar(
  input: Partial<AttendanceCalendarSettings>,
): AttendanceCalendarSettings {
  return {
    workingDays: normalizeWorkingDays(input.workingDays),
    holidays: normalizeHolidays(input.holidays),
  };
}

/** Local calendar date as YYYY-MM-DD (no UTC shift). */
export function formatAttendanceYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayAttendanceYmd(now: Date = new Date()): string {
  return formatAttendanceYmd(now);
}

function parseYmd(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** ISO weekday (1=Mon … 7=Sun) for a YYYY-MM-DD date. */
export function isoWeekdayOf(value: string): number {
  const day = parseYmd(value).getDay();
  return day === 0 ? 7 : day;
}

export function isWorkingDay(value: string, calendar: AttendanceCalendarSettings): boolean {
  return calendar.workingDays.includes(isoWeekdayOf(value));
}

export function isCalendarHoliday(
  value: string,
  calendar: AttendanceCalendarSettings,
): boolean {
  return calendar.holidays.includes(value);
}

export interface DeriveAttendanceStatusInput {
  /** YYYY-MM-DD of the day being evaluated. */
  date: string;
  /** YYYY-MM-DD of "today" (local). */
  today: string;
  hasPunches: boolean;
  /** Explicit AttendanceDay override — always authoritative. */
  override?: AttendanceDisplayStatus | null;
  calendar: AttendanceCalendarSettings;
  /** Employment start (YYYY-MM-DD); earlier days are OFF, not absent. */
  employedFrom?: string | null | undefined;
  /** Employment end (YYYY-MM-DD); later days are OFF, not absent. */
  employedTo?: string | null | undefined;
}

export function deriveAttendanceStatus(
  input: DeriveAttendanceStatusInput,
): AttendanceDisplayStatus {
  if (input.override) return input.override;

  if (input.employedFrom && input.date < input.employedFrom) return 'OFF';
  if (input.employedTo && input.date > input.employedTo) return 'OFF';

  if (isCalendarHoliday(input.date, input.calendar)) return 'HOLIDAY';
  if (!isWorkingDay(input.date, input.calendar)) return 'OFF';

  // Never mark a future working day absent.
  if (input.date > input.today) return 'SCHEDULED';

  return input.hasPunches ? 'PRESENT' : 'ABSENT';
}

export interface AttendanceCalendarRow {
  date: string;
  status: AttendanceDisplayStatus;
  hasPunches: boolean;
}

export interface AttendanceCalendarCounts {
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  holiday: number;
  off: number;
  scheduled: number;
}

export interface BuildAttendanceCalendarInput {
  /** Inclusive YYYY-MM-DD bounds. */
  from: string;
  to: string;
  today: string;
  calendar: AttendanceCalendarSettings;
  /** Days (YYYY-MM-DD) that have at least one punch. */
  punchDates: ReadonlySet<string>;
  /** Explicit overrides by YYYY-MM-DD. */
  overrides?: ReadonlyMap<string, AttendanceDisplayStatus>;
  employedFrom?: string | null | undefined;
  employedTo?: string | null | undefined;
}

export function enumerateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = parseYmd(from);
  const end = parseYmd(to);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return dates;

  while (cursor <= end) {
    dates.push(formatAttendanceYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/**
 * Build the calendar rows for a date range. Future days without an override or
 * punches are omitted (they have not happened yet); weekends/holidays are
 * emitted as OFF/HOLIDAY so the CSV and the daily page tell the same story.
 */
export function buildAttendanceCalendarRows(input: BuildAttendanceCalendarInput): {
  rows: AttendanceCalendarRow[];
  counts: AttendanceCalendarCounts;
} {
  const rows: AttendanceCalendarRow[] = [];

  for (const date of enumerateDateRange(input.from, input.to)) {
    const override = input.overrides?.get(date) ?? null;
    const hasPunches = input.punchDates.has(date);

    if (!override && !hasPunches && date > input.today) continue;

    rows.push({
      date,
      status: deriveAttendanceStatus({
        date,
        today: input.today,
        hasPunches,
        override,
        calendar: input.calendar,
        employedFrom: input.employedFrom,
        employedTo: input.employedTo,
      }),
      hasPunches,
    });
  }

  const counts: AttendanceCalendarCounts = {
    present: 0,
    absent: 0,
    leave: 0,
    halfDay: 0,
    holiday: 0,
    off: 0,
    scheduled: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case 'PRESENT':
        counts.present += 1;
        break;
      case 'ABSENT':
        counts.absent += 1;
        break;
      case 'LEAVE':
        counts.leave += 1;
        break;
      case 'HALF_DAY':
        counts.halfDay += 1;
        break;
      case 'HOLIDAY':
        counts.holiday += 1;
        break;
      case 'SCHEDULED':
        counts.scheduled += 1;
        break;
      default:
        counts.off += 1;
    }
  }

  return { rows, counts };
}
