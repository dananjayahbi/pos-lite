import { formatRupee } from '@/lib/format';

/**
 * ARGUS #117: one date and money convention for the shift ledger, shift detail
 * and the Z-report.
 *
 * Staff pages used `en-LK` ("Nov 14, 2026, 8:24 PM"), the Z-report used
 * `en-US` and sales/returns used `en-GB`. They now all use the day-first
 * `en-GB` form: "14 Nov 2026, 20:24". Receipts keep their DD/MM/YYYY layout,
 * which is already day-first.
 */
export function formatShiftDateTime(
  value: string | Date | null | undefined,
  timeZone?: string,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  });
}

/**
 * Money with the sign in front of the currency symbol.
 *
 * `formatRupee(-2978)` renders "Rs. -2,978.00"; a difference should read
 * "-Rs. 2,978.00". `sign: 'always'` also prefixes non-negative values with "+"
 * (used by the cash-difference row).
 */
export function formatShiftRupee(
  value: number | string,
  options?: { sign?: 'auto' | 'always' },
): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(amount)) return 'Rs. 0.00';

  const magnitude = formatRupee(Math.abs(amount));
  if (amount < 0) return `-${magnitude}`;
  return options?.sign === 'always' ? `+${magnitude}` : magnitude;
}
