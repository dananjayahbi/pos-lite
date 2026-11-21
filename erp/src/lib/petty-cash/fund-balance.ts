/**
 * ARGUS #403 - pure fund-balance delta decision used inside the locked
 * transaction. Keeping the arithmetic out of the Prisma call makes the
 * non-negative rule testable without a database.
 */
import Decimal from 'decimal.js';

export interface FundDeltaOptions {
  /** Block a result below zero unless `approved` is true. */
  enforceNonNegative?: boolean;
  /** Manager-approved overdraft. */
  approved?: boolean;
}

export interface FundDeltaDecision {
  currentBalance: number;
  nextBalance: number;
  allowed: boolean;
  reason: string | null;
}

export function decideFundDelta(
  currentBalance: number | string,
  delta: number,
  options: FundDeltaOptions = {},
): FundDeltaDecision {
  const current = new Decimal(currentBalance);
  const next = current.plus(delta).toDecimalPlaces(2);
  const blocked =
    options.enforceNonNegative === true &&
    options.approved !== true &&
    next.lessThan(0);

  return {
    currentBalance: current.toNumber(),
    nextBalance: next.toNumber(),
    allowed: !blocked,
    reason: blocked
      ? `Petty cash fund cannot go negative: expense of ${Math.abs(delta).toFixed(2)} exceeds the available balance of ${current.toDecimalPlaces(2).toNumber().toFixed(2)}`
      : null,
  };
}
