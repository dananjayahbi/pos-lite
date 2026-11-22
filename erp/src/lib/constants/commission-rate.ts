/**
 * Single commission-rate contract (ARGUS #342).
 *
 * Staff could be saved at 999.99% because the validator mirrored the
 * Decimal(5,2) column, while the form capped at 100 and the commission engine
 * rejected anything above 100. The account then silently earned nothing. One
 * 0-100 contract is now shared by the form, the staff API validator, the
 * commission engine and the sale-side record creation.
 */

export const COMMISSION_RATE_MIN = 0;
export const COMMISSION_RATE_MAX = 100;

export const COMMISSION_RATE_BOUND_MESSAGE = `Commission rate must be between ${COMMISSION_RATE_MIN} and ${COMMISSION_RATE_MAX}`;

/** True for a finite numeric rate inside the inclusive 0-100 range. */
export function isValidCommissionRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= COMMISSION_RATE_MIN &&
    value <= COMMISSION_RATE_MAX
  );
}

/**
 * Parse a stored or submitted rate. Returns null when the value is missing or
 * outside the contract, so callers can skip commission instead of writing a
 * record that can never earn.
 */
export function normalizeCommissionRate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return isValidCommissionRate(parsed) ? parsed : null;
}
