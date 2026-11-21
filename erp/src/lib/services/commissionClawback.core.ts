import Decimal from 'decimal.js';

/**
 * ARGUS #361 — commission clawback basis.
 *
 * Commission is earned at sale completion on the sale total. When goods are
 * returned the commissionable base shrinks by the refunded amount; when a sale
 * is voided the whole base goes away. Instead of mutating the original record
 * (which may already have been paid), the ledger is reconciled to a target base
 * with a new negative adjustment row. Re-running the same reconciliation finds
 * `existingBase === targetBase` and does nothing, so retries/replays cannot
 * double-claw.
 */

type Decimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface CommissionReversalPlanInput {
  /** Sum of the original positive commission bases for the sale. */
  originalBase: Decimalish;
  /** Commission rate snapshot (percentage, e.g. 10 for 10%). */
  commissionRate: Decimalish;
  /** Sum of completed return refunds for the sale (goods + tax). */
  returnedBase?: Decimalish | undefined;
  /** A voided sale has no remaining commissionable base. */
  voided?: boolean | undefined;
  /** Signed sum of all commission bases already recorded for the sale. */
  existingBase: Decimalish;
}

export interface CommissionReversalPlan {
  /** Base that should remain commissionable after this event. */
  targetBase: Decimal;
  /** Signed base already on the ledger. */
  existingBase: Decimal;
  /** Negative base adjustment to write now; zero when no row is needed. */
  adjustmentBase: Decimal;
  /** Negative earned adjustment to write now (proportional to the rate). */
  adjustmentEarned: Decimal;
  /** A paid payout is never mutated; the negative row stays outstanding. */
  createsOutstandingAdjustment: boolean;
  noop: boolean;
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

export function planCommissionReversal(
  input: CommissionReversalPlanInput,
): CommissionReversalPlan {
  const originalBase = Decimal.max(toDecimal(input.originalBase), 0);
  const rate = toDecimal(input.commissionRate);
  const returnedBase = Decimal.max(toDecimal(input.returnedBase), 0);
  const existingBase = toDecimal(input.existingBase);

  const targetBase = input.voided
    ? new Decimal(0)
    : Decimal.max(originalBase.minus(returnedBase), 0);

  // Never add commission back automatically: only a shortfall is clawed back.
  const rawAdjustment = targetBase.minus(existingBase);
  const adjustmentBase = rawAdjustment.lt(0) ? round2(rawAdjustment) : new Decimal(0);
  const adjustmentEarned = round2(adjustmentBase.mul(rate).div(100));

  return {
    targetBase: round2(targetBase),
    existingBase: round2(existingBase),
    adjustmentBase,
    adjustmentEarned,
    createsOutstandingAdjustment: adjustmentEarned.lt(0),
    noop: adjustmentBase.isZero(),
  };
}
