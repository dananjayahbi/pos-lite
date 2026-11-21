/**
 * Inclusive date-range parsing for report filters.
 *
 * Historically this module expanded date-only values to UTC midnight /
 * 23:59:59.999Z. In a +05:30 store that shifted the local day by 5.5 hours, so
 * a "From" label included entries from the previous evening and the Expenses
 * cash flow (which used a different upper bound) disagreed with the account
 * book. It now delegates to the shared local-calendar helper used by inventory
 * movement filters (ARGUS #184 / #429).
 */
import {
  inclusiveRangeEnd,
  inclusiveRangeStart,
} from '@/lib/api/inclusive-date-range';

export function parseRangeStart(value: string | Date): Date {
  if (value instanceof Date) return value;
  return inclusiveRangeStart(value) ?? new Date(value);
}

export function parseRangeEnd(value: string | Date): Date {
  if (value instanceof Date) return value;
  return inclusiveRangeEnd(value) ?? new Date(value);
}

/** Format a Date as the `YYYY-MM-DD` value a local date input expects. */
export function formatLocalDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
