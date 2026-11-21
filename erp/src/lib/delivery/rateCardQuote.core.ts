/**
 * ARGUS #296 - the rate card accepted unbounded weights and rates, so a public
 * quote for 1,000,000 kg produced an absurd figure. These limits are shared by
 * the validators, the quote routes and the editor's built-in preview.
 */

/** A parcel heavier than this is a data-entry error, not a courier job. */
export const MAX_RATE_WEIGHT_KG = 500;

/** Upper bound for any single rate field (Rs). */
export const MAX_RATE_AMOUNT = 1_000_000;

export interface RateQuoteInput {
  weightKg: number;
  baseRate: number;
  extraKgRate: number;
  freeBaseWeightKg: number;
}

export interface RateQuoteResult {
  ok: boolean;
  error?: string;
  shippingFee?: number;
  extraKg?: number;
}

function validNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Same arithmetic as the server engine, for the editor's example quote. */
export function quoteRateCard(input: RateQuoteInput): RateQuoteResult {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    return { ok: false, error: 'Enter a weight greater than zero.' };
  }
  if (input.weightKg > MAX_RATE_WEIGHT_KG) {
    return {
      ok: false,
      error: `Weight cannot exceed ${MAX_RATE_WEIGHT_KG} kg.`,
    };
  }
  if (
    !validNumber(input.baseRate) ||
    !validNumber(input.extraKgRate) ||
    !validNumber(input.freeBaseWeightKg)
  ) {
    return { ok: false, error: 'Rates must be zero or greater.' };
  }
  if (input.baseRate > MAX_RATE_AMOUNT || input.extraKgRate > MAX_RATE_AMOUNT) {
    return { ok: false, error: `A rate cannot exceed Rs ${MAX_RATE_AMOUNT.toLocaleString()}.` };
  }

  const extraKg =
    input.weightKg <= input.freeBaseWeightKg
      ? 0
      : Math.ceil(input.weightKg - input.freeBaseWeightKg);
  const shippingFee = Math.round((input.baseRate + extraKg * input.extraKgRate) * 100) / 100;
  return { ok: true, shippingFee, extraKg };
}
