/**
 * Commission payout presentation (ARGUS #370).
 *
 * `CommissionPayout.totalEarned` stores the amount actually paid by a payout
 * (partial payouts store the paid part, not the period's earnings). The API now
 * exposes it as `amountPaid`; the old name stays for older clients.
 *
 * Dates use en-GB/en-LK formatting like the rest of the app instead of the
 * browser-default `toLocaleString()`.
 */

type Decimalish = string | number | { toString(): string } | null | undefined;

export interface CommissionPayoutAmountRow {
  amountPaid?: Decimalish;
  totalEarned?: Decimalish;
}

function toAmount(value: Decimalish): string {
  if (value === null || value === undefined) return '0.00';
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

/** Paid amount for a payout row, preferring the correctly named field. */
export function commissionPayoutAmount(row: CommissionPayoutAmountRow): string {
  if (row.amountPaid !== undefined && row.amountPaid !== null) {
    return toAmount(row.amountPaid);
  }
  return toAmount(row.totalEarned);
}

export function formatCommissionDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCommissionDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "01 Nov 2026 - 30 Nov 2026". */
export function formatCommissionWindow(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  return `${formatCommissionDate(start)} - ${formatCommissionDate(end)}`;
}
