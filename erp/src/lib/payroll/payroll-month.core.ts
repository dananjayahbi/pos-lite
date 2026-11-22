/**
 * Payroll month contract (ARGUS #382).
 *
 * A payroll run is a monthly snapshot, so the month is always a `YYYY-MM` key
 * that cannot be in the future. The Run Payroll page already capped its native
 * month input; these helpers move the same rule to the API so a crafted request
 * cannot preview or generate a future month, and keep the pickers' maximum in
 * sync with the server.
 */

export const PAYROLL_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type PayrollMonthProblem = 'INVALID' | 'FUTURE';

export type PayrollMonthResult =
  | { ok: true; month: string }
  | { ok: false; problem: PayrollMonthProblem; message: string };

/** Current month in the caller's local calendar, as `YYYY-MM`. */
export function currentPayrollMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Validate a requested month. `null`/empty means "current month", matching the
 * preview and generate endpoints.
 */
export function validatePayrollMonth(
  value: string | null | undefined,
  now: Date = new Date(),
): PayrollMonthResult {
  const month = value?.trim() || currentPayrollMonth(now);
  if (!PAYROLL_MONTH_PATTERN.test(month)) {
    return { ok: false, problem: 'INVALID', message: 'month must be YYYY-MM' };
  }
  if (month > monthKey(now)) {
    return {
      ok: false,
      problem: 'FUTURE',
      message: 'Payroll cannot be prepared for a future month',
    };
  }
  return { ok: true, month };
}
