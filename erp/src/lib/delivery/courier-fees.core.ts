import Decimal from 'decimal.js';

/**
 * Courier service-fee arithmetic (ARGUS #293).
 *
 * The contract's VAT is charged on the courier SERVICE, not on the cash the
 * courier collects:
 *
 *   commission = grossCOD x COD%
 *   VAT base   = deliveryFee + commission
 *   VAT        = VATbase x VAT%
 *   net payout = grossCOD - deliveryFee - commission - VAT
 *
 * At 18% on Rs 10,000 COD with a Rs 250 fee and 3% commission the VAT is
 * Rs 99 (18% of 550), not Rs 1,800 (18% of the whole COD). Kept pure so the
 * rate engine, reconciliation and tests share one definition.
 */

export type FeeDecimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface CourierFeeInput {
  grossCod: FeeDecimalish;
  deliveryFee?: FeeDecimalish;
  coddCommissionPct?: FeeDecimalish;
  vatRatePct?: FeeDecimalish;
}

export interface CourierFeeBreakdown {
  grossCod: Decimal;
  deliveryFee: Decimal;
  codCommission: Decimal;
  /** deliveryFee + codCommission - the explicit VAT basis. */
  vatBase: Decimal;
  vatAmount: Decimal;
  totalDeduction: Decimal;
  netPayout: Decimal;
}

function toDecimal(value: FeeDecimalish): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(0);
  }
}

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function percent(value: FeeDecimalish): Decimal {
  const pct = toDecimal(value);
  return pct.isNegative() ? new Decimal(0) : pct.div(100);
}

export function computeCourierFeeBreakdown(input: CourierFeeInput): CourierFeeBreakdown {
  const grossCod = money(toDecimal(input.grossCod));
  const deliveryFee = money(toDecimal(input.deliveryFee));
  const codCommission = money(grossCod.times(percent(input.coddCommissionPct)));
  const vatBase = money(deliveryFee.plus(codCommission));
  const vatAmount = money(vatBase.times(percent(input.vatRatePct)));
  const totalDeduction = money(deliveryFee.plus(codCommission).plus(vatAmount));
  const netPayout = money(grossCod.minus(totalDeduction));

  return {
    grossCod,
    deliveryFee,
    codCommission,
    vatBase,
    vatAmount,
    totalDeduction,
    netPayout,
  };
}
