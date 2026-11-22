/**
 * Inclusive local-month commission periods (ARGUS #343).
 *
 * The commission page built its default window from `Date.toISOString()` on
 * local midnights. In a UTC+05:30 shop that turned 1 November into
 * `2026-10-31` and 30 November into `2026-11-29`, so the default report ran
 * 31 Oct - 29 Nov and ended at 05:29 on the last day.
 *
 * This module is pure (safe for client and server) and always treats a
 * `YYYY-MM-DD` window as local calendar days: start at local 00:00:00.000 and
 * end at local 23:59:59.999, inclusive.
 */

export class CommissionPeriodError extends Error {
  readonly code = 'INVALID_COMMISSION_PERIOD';

  constructor(message: string) {
    super(message);
    this.name = 'CommissionPeriodError';
  }
}

export interface CommissionPeriod {
  /** Inclusive local start date, YYYY-MM-DD. */
  startDate: string;
  /** Inclusive local end date, YYYY-MM-DD. */
  endDate: string;
  /** Local start of the first day. */
  periodStart: Date;
  /** Local end of the last day (23:59:59.999). */
  periodEnd: Date;
  /** The same boundaries as UTC instants, for ISO query strings. */
  startIso: string;
  endIso: string;
}

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function formatLocalDateYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseLocalYmd(value: string): Date | null {
  if (!YMD_PATTERN.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;
  if (day < 1 || day > lastDayOfMonth(year, monthIndex)) return null;
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

interface ParsedInput {
  date: Date;
  /**
   * A full ISO timestamp already carries the caller's intended instant. It is
   * passed through unchanged so a UTC server cannot shift a browser-local
   * month boundary by a day. Date-only values are expanded to local day
   * boundaries below.
   */
  exact: boolean;
}

/**
 * Accept either a `YYYY-MM-DD` day or a full ISO timestamp.
 */
function parseInput(value: string | null | undefined): ParsedInput | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const local = parseLocalYmd(trimmed);
  if (local) return { date: local, exact: false };
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: parsed, exact: true };
}

/**
 * Resolve an inclusive commission window.
 *
 * - no inputs           -> the current local month
 * - start only          -> start through the end of that local month
 * - end only            -> the first of that local month through end
 * - both date-only      -> exactly those local calendar days, inclusive
 * - both ISO timestamps -> the exact instants supplied (browser-local
 *                          boundaries survive a UTC server)
 *
 * Throws `CommissionPeriodError` for malformed dates or an inverted window.
 */
export function resolveCommissionPeriod(
  startValue?: string | null,
  endValue?: string | null,
  now: Date = new Date(),
): CommissionPeriod {
  const startInput = parseInput(startValue);
  const endInput = parseInput(endValue);

  if (startValue?.trim() && !startInput) {
    throw new CommissionPeriodError('periodStart must be a valid date');
  }
  if (endValue?.trim() && !endInput) {
    throw new CommissionPeriodError('periodEnd must be a valid date');
  }

  let start = startInput;
  let end = endInput;

  if (!start && !end) {
    start = {
      date: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      exact: false,
    };
    end = {
      date: new Date(
        now.getFullYear(),
        now.getMonth(),
        lastDayOfMonth(now.getFullYear(), now.getMonth()),
        0,
        0,
        0,
        0,
      ),
      exact: false,
    };
  } else if (start && !end) {
    end = {
      date: new Date(
        start.date.getFullYear(),
        start.date.getMonth(),
        lastDayOfMonth(start.date.getFullYear(), start.date.getMonth()),
        0,
        0,
        0,
        0,
      ),
      exact: false,
    };
  } else if (!start && end) {
    start = {
      date: new Date(end.date.getFullYear(), end.date.getMonth(), 1, 0, 0, 0, 0),
      exact: false,
    };
  }

  if (!start || !end) {
    throw new CommissionPeriodError('Invalid commission period');
  }

  const periodStart = start.exact
    ? new Date(start.date.getTime())
    : new Date(
        start.date.getFullYear(),
        start.date.getMonth(),
        start.date.getDate(),
        0,
        0,
        0,
        0,
      );
  const periodEnd = end.exact
    ? new Date(end.date.getTime())
    : new Date(
        end.date.getFullYear(),
        end.date.getMonth(),
        end.date.getDate(),
        23,
        59,
        59,
        999,
      );

  if (periodEnd.getTime() < periodStart.getTime()) {
    throw new CommissionPeriodError('periodEnd must not be before periodStart');
  }

  return {
    startDate: formatLocalDateYmd(periodStart),
    endDate: formatLocalDateYmd(periodEnd),
    periodStart,
    periodEnd,
    startIso: periodStart.toISOString(),
    endIso: periodEnd.toISOString(),
  };
}
