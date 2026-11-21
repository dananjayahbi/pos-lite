import Decimal from 'decimal.js';

/**
 * Commission rate used for a reversal/clawback (ARGUS #365).
 *
 * The rate that earned the original commission is stored on each
 * `CommissionRecord`. Reversals must use that stored rate, never the staff
 * member's current `User.commissionRate`, otherwise a later rate change would
 * claw back a different percentage from the amount originally paid.
 *
 * With duplicate/mixed-rate records for one sale, the earned/base ratio is a
 * weighted average that keeps the reversal proportional to what was earned.
 */

type Decimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface CommissionRateBasis {
  baseAmount: Decimalish;
  earnedAmount: Decimalish;
}

function toDecimal(value: Decimalish): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(0);
  }
}

export function resolveStoredCommissionRate(
  records: readonly CommissionRateBasis[],
): Decimal | null {
  let base = new Decimal(0);
  let earned = new Decimal(0);

  for (const record of records) {
    const recordBase = toDecimal(record.baseAmount);
    // Only positive earning records define the original rate; negative
    // adjustment rows are the result of a reversal, not its basis.
    if (recordBase.lte(0)) continue;
    base = base.plus(recordBase);
    earned = earned.plus(toDecimal(record.earnedAmount));
  }

  if (base.lte(0) || earned.lte(0)) return null;
  return earned.div(base).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
