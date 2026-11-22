/**
 * Cash Flow date-range validation (ARGUS #422).
 *
 * `dateFrom=2030-12-31&dateTo=2024-01-01` used to return 200 with every total at
 * zero, which the page rendered as "No financial activity recorded" - a
 * valid-looking empty statement. A reversed range is a bad request.
 */

export interface CashFlowRangeValidation {
  ok: boolean;
  message: string | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  // `YYYY-MM-DD` means the local calendar day, matching the report filters.
  if (DATE_ONLY.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const date = new Date(year!, month! - 1, day!);
    // Reject rolled-over dates such as 2026-02-31.
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month! - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Validate already-resolved dates (server-side, after inclusive-range parsing). */
export function validateCashFlowRangeDates(
  from: Date | null | undefined,
  to: Date | null | undefined,
): CashFlowRangeValidation {
  if (!from || !to) {
    return {
      ok: false,
      message: 'Select both a From and a To date.',
    };
  }
  if (from.getTime() > to.getTime()) {
    return {
      ok: false,
      message: 'From date must be on or before the To date.',
    };
  }
  return { ok: true, message: null };
}

/** Validate the raw `YYYY-MM-DD` / ISO values used by the page. */
export function validateCashFlowRange(
  from: string | null | undefined,
  to: string | null | undefined,
): CashFlowRangeValidation {
  const parsedFrom = parseDate(from);
  const parsedTo = parseDate(to);
  if (!parsedFrom || !parsedTo) {
    return {
      ok: false,
      message: 'Enter valid From and To dates.',
    };
  }
  return validateCashFlowRangeDates(parsedFrom, parsedTo);
}
