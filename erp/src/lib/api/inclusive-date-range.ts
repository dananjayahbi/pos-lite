/**
 * ARGUS #184 - inclusive calendar-day filters for report/list query params.
 *
 * A `YYYY-MM-DD` filter means the whole local calendar day, not UTC midnight:
 * `to=2026-11-15` must include rows written that evening. This mirrors the
 * Sales history and appointment date filters, which build local
 * `00:00:00.000` / `23:59:59.999` boundaries.
 *
 * Full ISO timestamps stay exact instants, so API callers that already send a
 * date-time keep their current semantics. Callers should validate malformed
 * values separately (e.g. `parseQueryDate`) so this helper only handles shape,
 * not error reporting.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface InclusiveDateRange {
  /** Inclusive start of the range, when the caller supplied `from`. */
  from?: Date;
  /** Inclusive end of the range, when the caller supplied `to`. */
  to?: Date;
}

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function validDate(value: Date): Date | undefined {
  return Number.isNaN(value.getTime()) ? undefined : value;
}

/** Parse `YYYY-MM-DD` parts into a local Date, or `null` for a timestamp. */
function dateOnlyParts(value: string): [number, number, number] | null {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return [Number(year), Number(month), Number(day)];
}

/** Local `00:00:00.000` for a date-only value; exact instant for a timestamp. */
export function inclusiveRangeStart(value: string | null | undefined): Date | undefined {
  const trimmed = clean(value);
  if (trimmed === null) return undefined;

  const parts = dateOnlyParts(trimmed);
  if (parts) {
    const [year, month, day] = parts;
    return validDate(new Date(year, month - 1, day, 0, 0, 0, 0));
  }
  return validDate(new Date(trimmed));
}

/** Local `23:59:59.999` for a date-only value; exact instant for a timestamp. */
export function inclusiveRangeEnd(value: string | null | undefined): Date | undefined {
  const trimmed = clean(value);
  if (trimmed === null) return undefined;

  const parts = dateOnlyParts(trimmed);
  if (parts) {
    const [year, month, day] = parts;
    return validDate(new Date(year, month - 1, day, 23, 59, 59, 999));
  }
  return validDate(new Date(trimmed));
}

/**
 * Resolve `from`/`to` query values into an inclusive range. Missing/blank
 * values are simply absent, so an open-ended filter stays open-ended.
 */
export function resolveInclusiveDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): InclusiveDateRange {
  const range: InclusiveDateRange = {};
  const start = inclusiveRangeStart(from);
  const end = inclusiveRangeEnd(to);
  if (start) range.from = start;
  if (end) range.to = end;
  return range;
}
