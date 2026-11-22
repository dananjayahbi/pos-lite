import Decimal from 'decimal.js';

/**
 * Pure shipping-rate arithmetic (ARGUS #287).
 *
 * The rate card stores `baseRate`, `extraKgRate` and `freeBaseWeightKg`. The
 * contract is: the base rate covers the first `freeBaseWeightKg`; every further
 * kilogram (rounded UP, so 0.1 kg extra counts as a whole kg) adds
 * `extraKgRate`.
 *
 *   fee = baseRate                                   when weight <= freeBaseWeightKg
 *   fee = baseRate + ceil(weight - free) * extraKgRate otherwise
 *
 * Kept free of Prisma so the website quote, the ERP manual delivery path and
 * the courier flow all share one testable rule.
 */

export type RateDecimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface ShippingRateTerms {
  baseRate: RateDecimalish;
  extraKgRate: RateDecimalish;
  freeBaseWeightKg: RateDecimalish;
}

export interface ShippingRateQuote {
  shippingFee: Decimal;
  baseRate: Decimal;
  extraKgRate: Decimal;
  extraKg: Decimal;
  freeBaseWeightKg: Decimal;
}

function toDecimal(value: RateDecimalish, fallback = '0'): Decimal {
  if (value === null || value === undefined) return new Decimal(fallback);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(fallback);
  }
}

export function computeShippingFeeFromTerms(
  weightKg: RateDecimalish,
  terms: ShippingRateTerms,
): ShippingRateQuote {
  const baseRate = toDecimal(terms.baseRate);
  const extraKgRate = toDecimal(terms.extraKgRate);
  const freeBaseWeightKg = toDecimal(terms.freeBaseWeightKg, '0');
  const weight = toDecimal(weightKg);

  if (weight.lessThanOrEqualTo(freeBaseWeightKg)) {
    return {
      shippingFee: baseRate,
      baseRate,
      extraKgRate,
      extraKg: new Decimal(0),
      freeBaseWeightKg,
    };
  }

  const extraKg = weight.minus(freeBaseWeightKg).ceil();
  return {
    shippingFee: baseRate.plus(extraKg.times(extraKgRate)),
    baseRate,
    extraKgRate,
    extraKg,
    freeBaseWeightKg,
  };
}
