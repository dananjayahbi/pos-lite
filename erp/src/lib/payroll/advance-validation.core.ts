import Decimal from 'decimal.js';

/**
 * Salary advance validation (ARGUS #379).
 *
 * There is no advance register/outstanding-balance table in the schema and no
 * migration may be added, so a real advance ledger cannot be enforced here.
 * The safe, documented rule is: an advance cannot deduct more than the
 * employee's net pay before that advance. This prevents negative net pay and
 * accidental over-deduction, but it does NOT remember what was advanced in a
 * previous month.
 */

type Decimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface PayrollAdvanceValidation {
  requested: string;
  allowed: string;
  /** Net pay before the advance: the maximum this run may deduct. */
  maxAdvance: string;
  capped: boolean;
  message: string | null;
}

function toDecimal(value: Decimalish): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(0);
  }
}

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function validatePayrollAdvance(input: {
  requested: Decimalish;
  netBeforeAdvance: Decimalish;
}): PayrollAdvanceValidation {
  const requested = Decimal.max(round2(toDecimal(input.requested)), 0);
  const maxAdvance = Decimal.max(round2(toDecimal(input.netBeforeAdvance)), 0);
  const capped = requested.gt(maxAdvance.plus(0.005));
  const allowed = capped ? maxAdvance : requested;

  return {
    requested: round2(requested).toFixed(2),
    allowed: round2(allowed).toFixed(2),
    maxAdvance: round2(maxAdvance).toFixed(2),
    capped,
    message: capped
      ? `Salary advance capped at ${round2(maxAdvance).toFixed(2)} because net pay before the advance is ${round2(
          maxAdvance,
        ).toFixed(2)}.`
      : null,
  };
}
